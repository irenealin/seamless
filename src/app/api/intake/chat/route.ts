import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RequirementsSchema, type Requirements } from "@/lib/intakeTypes";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  current: RequirementsSchema.optional(),
});

const ResponseSchema = z.object({
  assistantMessage: z.string().min(1),
  requirements: RequirementsSchema.optional(),
  isComplete: z.boolean().optional(),
  missing: z.array(z.string()).optional(),
});

const REQUIRED_FIELDS: Array<keyof Requirements> = ["areaLabel", "headcount", "budgetTotal"];
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_K = 6;

const SYSTEM_PROMPT = `You are an intake concierge for private dining events.
Your job is to extract structured requirements from the conversation.
Ask at most ONE focused follow-up question only if critical info is missing.
Never ask for date or time.
Do NOT ask about cake fees or corkage fees unless the user explicitly brings them up.
If vibe is missing, ask about it as a secondary, optional preference (but do not block completion on it).
When the user mentions a city name (e.g., "sf dinner", "san francisco", "chicago") infer and set areaLabel to that city even if they don't explicitly say "location".
If the user mentions a specific restaurant name, set restaurantQuery to that name.
When restaurantQuery is present, you should still ask ONE focused follow-up question for missing critical info (location/headcount/budget) but also confirm you will surface that restaurant plus similar options.
Expand common abbreviations (e.g., "sf" -> "San Francisco, CA"; "nyc" -> "New York, NY"; "la" -> "Los Angeles, CA").
If enough info is available, confirm briefly and say you are ready to recommend venues.
Return a single JSON object with keys: assistantMessage, requirements, isComplete, missing.
Requirements must only include these keys:
areaLabel, radiusMiles, headcount, budgetTotal, needsAV, eventType, dateNeeded, timeNeeded, privacyLevel, noiseLevel, vibe, restaurantQuery, maxCakeFee, maxCorkageFee.
Use strings for all text/number fields and boolean for needsAV.
Missing should be an array of required field names.`;

function mergeRequirements(current: Requirements | undefined, incoming: Requirements | undefined) {
  const next: Requirements = { ...(current ?? {}) };
  if (!incoming) return next;

  for (const [key, value] of Object.entries(incoming) as [keyof Requirements, unknown][]) {
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    (next as Record<string, unknown>)[key] = value;
  }

  return next;
}

function computeMissing(requirements: Requirements) {
  return REQUIRED_FIELDS.filter((field) => {
    const value = requirements[field];
    return !value || (typeof value === "string" && value.trim() === "");
  }).map((field) => field.toString());
}

function safeJsonParse(content: string) {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function normalizeNotes(notes: string) {
  return notes.replace(/\s+/g, " ").trim();
}

function parseNumber(value?: string) {
  if (!value) return null;
  const match = value.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function buildCityToken(label?: string) {
  const raw = (label ?? "").split(",")[0]?.trim();
  if (!raw) return "";
  return raw.replace(/[^a-z0-9\s]/gi, " ").replace(/\s+/g, " ").trim();
}

async function fetchCandidateRoomIds(current: Requirements) {
  let query = supabaseServer.from("restaurant_rooms").select("id");

  const cityToken = buildCityToken(current.areaLabel);
  if (cityToken) {
    query = query.ilike("address", `%${cityToken}%`);
  }
  const headcount = parseNumber(current.headcount ?? "");
  if (headcount != null) {
    query = query.gte("seated_capacity", headcount);
  }
  const budgetTotal = parseNumber(current.budgetTotal ?? "");
  if (budgetTotal != null) {
    query = query.lte("min_spend_estimate", budgetTotal);
  }
  if (current.privacyLevel) {
    query = query.ilike("privacy_level", `%${current.privacyLevel}%`);
  }
  if (current.noiseLevel) {
    query = query.ilike("noise_level", `%${current.noiseLevel}%`);
  }
  if (current.needsAV) {
    query = query.ilike("a_v", "%yes%");
  }
  if (current.eventType) {
    query = query.ilike("event_type", `%${current.eventType}%`);
  }

  const { data, error } = await query.limit(500);
  if (error) {
    console.error("Failed to fetch candidate room ids:", error);
    return [];
  }
  return (data ?? []).map((row) => row.id) as number[];
}

async function retrieveRoomNotes({
  queryText,
  candidateIds,
}: {
  queryText: string;
  candidateIds: number[];
}) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embeddingResp = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: normalizeNotes(queryText),
    encoding_format: "float",
  });
  const queryEmbedding = embeddingResp.data[0]?.embedding ?? [];
  if (!queryEmbedding.length) {
    throw new Error("Empty query embedding");
  }

  const rpcArgs: Record<string, unknown> = {
    query_embedding: queryEmbedding,
    match_count: EMBEDDING_K,
  };
  if (candidateIds.length) rpcArgs.candidate_ids = candidateIds;

  const { data: matches, error: matchError } = await supabaseServer.rpc(
    "match_room_embeddings",
    rpcArgs
  );

  if (matchError) {
    console.error("Embedding match failed:", matchError);
    return [];
  }

  const matchRows = (matches ?? []) as Array<{ room_id: number; distance: number }>;
  if (!matchRows.length) return [];

  const roomIds = matchRows.map((m) => m.room_id);
  const { data: rooms, error: roomsError } = await supabaseServer
    .from("restaurant_rooms")
    .select("id,restaurant_name,room_name,notes")
    .in("id", roomIds);

  if (roomsError) {
    console.error("Failed to fetch rooms for matches:", roomsError);
    return [];
  }

  const roomMap = new Map<number, (typeof rooms)[number]>();
  for (const room of rooms ?? []) {
    roomMap.set(room.id, room);
  }

  return matchRows
    .map((m) => ({
      distance: m.distance,
      room: roomMap.get(m.room_id),
    }))
    .filter((item) => item.room?.notes)
    .map((item) => ({
      distance: item.distance,
      id: item.room!.id,
      restaurant_name: item.room!.restaurant_name ?? "",
      room_name: item.room!.room_name ?? "",
      notes: item.room!.notes ?? "",
    }));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const totalChars = parsed.data.messages.reduce<number>(
    (sum, msg) => sum + msg.content.length,
    0
  );
  if (totalChars > 20000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const current = parsed.data.current ?? {};
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let retrievalBlock = "";
  let hasRetrievedNotes = false;
  try {
    const lastUserMessage =
      [...parsed.data.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const candidateIds = await fetchCandidateRoomIds(current);
    const retrieved = await retrieveRoomNotes({
      queryText: lastUserMessage,
      candidateIds,
    });
    if (retrieved.length) {
      hasRetrievedNotes = true;
      retrievalBlock =
        "Retrieved room notes (use ONLY this info for answers):\n" +
        retrieved
          .map(
            (r, idx) =>
              `${idx + 1}. Restaurant: ${r.restaurant_name} | Room: ${r.room_name} | Notes: ${r.notes}`
          )
          .join("\n");
    }
  } catch (err) {
    console.error("Retrieval failed:", err);
  }

  let content = "";
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(hasRetrievedNotes
          ? [
              {
                role: "system",
                content:
                  "If the user is asking about a specific restaurant or restaurantQuery is present, summarize all available spaces/rooms from the retrieved notes. List each distinct space and its key details. Do not say you lack info if notes are present.",
              } as const,
            ]
          : []),
        {
          role: "system",
          content:
            "Answer using ONLY the retrieved notes when responding to informational questions. If the notes don't contain the answer, say you don't know or ask one clarifying question.",
        },
        ...(retrievalBlock ? [{ role: "system", content: retrievalBlock } as const] : []),
        { role: "system", content: `Current requirements: ${JSON.stringify(current)}` },
        ...parsed.data.messages,
      ],
    });

    content = response.choices[0]?.message?.content ?? "";
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
  const parsedJson = safeJsonParse(content);
  const parsedResponse = ResponseSchema.safeParse(parsedJson ?? {});

  if (!parsedResponse.success) {
    const missing = computeMissing(current);
    return NextResponse.json({
      assistantMessage:
        "I had trouble extracting the details. Could you confirm the location, headcount, and budget?",
      requirements: current,
      isComplete: missing.length === 0,
      missing,
    });
  }

  const requirementsParsed = RequirementsSchema.safeParse(parsedResponse.data.requirements ?? {});
  const merged = mergeRequirements(current, requirementsParsed.success ? requirementsParsed.data : {});
  const missing = computeMissing(merged);

  return NextResponse.json({
    assistantMessage: parsedResponse.data.assistantMessage,
    requirements: merged,
    isComplete: missing.length === 0,
    missing,
  });
}
