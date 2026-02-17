import "server-only";
import OpenAI from "openai";
import { createHash } from "crypto";
import { supabaseServer } from "@/lib/supabaseServer";

const MODEL = "text-embedding-3-small";
const DIMENSIONS = 1536;

type UpsertArgs = {
  roomId: number;
  notes?: string | null;
};

function normalizeNotes(notes?: string | null) {
  if (!notes) return "";
  return notes.replace(/\s+/g, " ").trim();
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export async function upsertRoomEmbedding({ roomId, notes }: UpsertArgs) {
  const normalized = normalizeNotes(notes);

  if (!normalized) {
    const { error } = await supabaseServer
      .from("room_embeddings")
      .delete()
      .eq("room_id", roomId)
      .eq("model", MODEL);
    if (error) {
      console.error("Failed to delete empty embedding:", error);
    } else {
      console.log(`Deleted embedding for room_id=${roomId} (empty notes).`);
    }
    return { status: "deleted" as const };
  }

  const textHash = sha256(normalized);

  const { data: existing, error: existingError } = await supabaseServer
    .from("room_embeddings")
    .select("text_hash, model")
    .eq("room_id", roomId)
    .maybeSingle();

  if (existingError) {
    console.error("Failed to check existing embedding:", existingError);
  } else if (existing?.text_hash === textHash && existing?.model === MODEL) {
    console.log(`Embedding unchanged for room_id=${roomId}, skipping.`);
    return { status: "skipped" as const };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.embeddings.create({
    model: MODEL,
    input: normalized,
    encoding_format: "float",
  });

  const embedding = response.data[0]?.embedding ?? [];
  if (embedding.length !== DIMENSIONS) {
    throw new Error(
      `Embedding length mismatch for room_id=${roomId}: got ${embedding.length}, expected ${DIMENSIONS}`
    );
  }

  const { error: upsertError } = await supabaseServer.from("room_embeddings").upsert(
    {
      room_id: roomId,
      embedding,
      model: MODEL,
      text_hash: textHash,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "room_id" }
  );

  if (upsertError) {
    console.error("Failed to upsert embedding:", upsertError);
    throw upsertError;
  }

  console.log(`Upserted embedding for room_id=${roomId}.`);
  return { status: "upserted" as const };
}
