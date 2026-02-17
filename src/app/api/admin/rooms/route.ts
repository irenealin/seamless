import "server-only";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { upsertRoomEmbedding } from "@/lib/embeddings/upsertRoomEmbedding";

export const runtime = "nodejs";

function requireAdmin(req: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing ADMIN_SECRET" }, { status: 500 });
  }
  const provided = req.headers.get("x-admin-secret");
  if (!provided || provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function POST(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { id: _ignoredId, notes, ...rest } = body;

  const { data, error } = await supabaseServer
    .from("restaurant_rooms")
    .insert({ ...rest, notes })
    .select("id")
    .single();

  if (error || !data?.id) {
    return NextResponse.json(
      { error: "Failed to create room", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }

  try {
    await upsertRoomEmbedding({ roomId: data.id, notes: (notes as string | null) ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Embedding failed";
    return NextResponse.json(
      { error: "Embedding failed", details: message, id: data.id },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });
  }

  const updateFields = { ...body };
  delete updateFields.id;

  const { data, error } = await supabaseServer
    .from("restaurant_rooms")
    .update(updateFields)
    .eq("id", id)
    .select("id")
    .single();

  if (error || !data?.id) {
    return NextResponse.json(
      { error: "Failed to update room", details: error?.message ?? "Unknown error" },
      { status: 500 }
    );
  }

  if (Object.prototype.hasOwnProperty.call(body, "notes")) {
    try {
      await upsertRoomEmbedding({ roomId: id, notes: (body.notes as string | null) ?? null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Embedding failed";
      return NextResponse.json(
        { error: "Embedding failed", details: message, id },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ id });
}
