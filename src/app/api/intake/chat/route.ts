import OpenAI from "openai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { RequirementsSchema, type Requirements } from "@/lib/intakeTypes";

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

const REQUIRED_FIELDS: Array<keyof Requirements> = [
  "areaLabel",
  "headcount",
  "budgetTotal",
  "dateNeeded",
  "timeNeeded",
];

const SYSTEM_PROMPT = `You are an intake concierge for private dining events.
Your job is to extract structured requirements from the conversation.
Ask at most ONE focused follow-up question only if critical info is missing.
Do NOT ask about cake fees or corkage fees unless the user explicitly brings them up.
If vibe is missing, ask about it as a secondary, optional preference (but do not block completion on it).
If enough info is available, confirm briefly and say you are ready to recommend venues.
Return a single JSON object with keys: assistantMessage, requirements, isComplete, missing.
Requirements must only include these keys:
areaLabel, radiusMiles, headcount, budgetTotal, needsAV, eventType, dateNeeded, timeNeeded, privacyLevel, noiseLevel, vibe, maxCakeFee, maxCorkageFee.
Use strings for all text/number fields and boolean for needsAV.
Missing should be an array of required field names.`;

function mergeRequirements(current: Requirements | undefined, incoming: Requirements | undefined) {
  const next: Requirements = { ...(current ?? {}) };
  if (!incoming) return next;

  for (const [key, value] of Object.entries(incoming) as [keyof Requirements, unknown][]) {
    if (value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    next[key] = value as Requirements[keyof Requirements];
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const totalChars = parsed.data.messages.reduce((sum, msg) => sum + msg.content.length, 0);
  if (totalChars > 20000) {
    return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  }

  const current = parsed.data.current ?? {};
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let content = "";
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
        "I had trouble extracting the details. Could you confirm the location, headcount, budget, date, and time?",
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
