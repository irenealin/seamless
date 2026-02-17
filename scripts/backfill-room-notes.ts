import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { config as loadEnv } from "dotenv";
import { createHash } from "crypto";

loadEnv({ path: ".env.local" });

type RoomRow = {
  id: number;
  notes: string | null;
};

type EmbeddingRow = {
  room_id: number;
  model: "text-embedding-3-small";
  embedding: number[];
  text_hash: string;
  updated_at: string;
};

const BATCH_SIZE = 100;
const MODEL = "text-embedding-3-small" as const;

function requireEnv(name: string, fallbackName?: string) {
  const value = process.env[name] ?? (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

async function main() {
  const supabaseUrl = requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  const supabaseKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = requireEnv("OPENAI_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey);
  const openai = new OpenAI({ apiKey: openaiKey });

  let offset = 0;
  let total = 0;
  let processed = 0;
  let skipped = 0;

  while (true) {
    const { data, error, count } = await supabase
      .from("restaurant_rooms")
      .select("id,notes", { count: "exact" })
      .not("notes", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error("Failed to fetch rows:", error);
      if (total && processed >= total) break;
      throw error;
    }

    if (count != null && total === 0) total = count;
    const rows = (data ?? []) as RoomRow[];

    if (!rows.length) break;

    const cleaned = rows
      .map((row) => ({
        id: row.id,
        notes: (row.notes ?? "").trim(),
      }))
      .filter((row) => row.notes.length > 0);

    skipped += rows.length - cleaned.length;

    if (!cleaned.length) {
      offset += BATCH_SIZE;
      continue;
    }

    try {
      const nextHashes = cleaned.map((row) => ({
        room_id: row.id,
        hash: createHash("sha256").update(row.notes).digest("hex"),
      }));

      const { data: existingHashes, error: hashError } = await supabase
        .from("room_embeddings")
        .select("room_id,text_hash")
        .eq("model", MODEL)
        .in("room_id", nextHashes.map((h) => h.room_id));

      if (hashError) {
        console.error("Failed to fetch existing hashes:", hashError.message);
        throw hashError;
      }

      const existingMap = new Map<number, string>();
      for (const row of existingHashes ?? []) {
        if (row.room_id != null && row.text_hash) {
          existingMap.set(Number(row.room_id), row.text_hash);
        }
      }

      const toEmbed = cleaned.filter((row) => {
        const nextHash = nextHashes.find((h) => h.room_id === row.id)?.hash ?? "";
        const prevHash = existingMap.get(row.id);
        if (prevHash && prevHash === nextHash) return false;
        return true;
      });

      if (!toEmbed.length) {
        skipped += cleaned.length;
        console.log(`Processed ${processed}/${total || "?"} (skipped ${skipped})`);
        offset += BATCH_SIZE;
        if (total && offset >= total) break;
        continue;
      }

      const embeddings = await openai.embeddings.create({
        model: MODEL,
        input: toEmbed.map((r) => r.notes),
        encoding_format: "float",
      });

      if (embeddings.data.length !== toEmbed.length) {
        throw new Error(
          `Embedding count mismatch: got ${embeddings.data.length}, expected ${toEmbed.length}`
        );
      }

      const payload: EmbeddingRow[] = toEmbed.map((row, idx) => {
        const embedding = embeddings.data[idx]?.embedding ?? [];
        if (!embedding.length) {
          throw new Error(`Empty embedding for room_id=${row.id}`);
        }
        const hash = createHash("sha256").update(row.notes).digest("hex");
        return {
          room_id: row.id,
          model: MODEL,
          embedding,
          text_hash: hash,
          updated_at: new Date().toISOString(),
        };
      });

      const roomIds = payload.map((row) => row.room_id);
      const { error: deleteError } = await supabase
        .from("room_embeddings")
        .delete()
        .eq("model", MODEL)
        .in("room_id", roomIds);

      if (deleteError) {
        console.error("Delete failed:", deleteError.message);
        throw deleteError;
      }

      const { error: insertError } = await supabase.from("room_embeddings").insert(payload);

      if (insertError) {
        console.error("Insert failed:", insertError.message);
        throw insertError;
      }

      processed += payload.length;
      skipped += cleaned.length - payload.length;
      console.log(`Processed ${processed}/${total || "?"} (skipped ${skipped})`);
    } catch (err) {
      console.error("Batch failed:", err);
    }

    offset += BATCH_SIZE;
    if (total && offset >= total) break;
  }

  console.log(`Done. Processed ${processed}, skipped ${skipped}.`);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
