import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabaseServer";

export const runtime = "nodejs";

const BodySchema = z.object({
  query: z.string().min(2).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const query = parsed.data.query.trim();
  const { data, error } = await supabaseServer
    .from("restaurant_rooms")
    .select("restaurant_name,address,lat,lng")
    .ilike("restaurant_name", `%${query}%`)
    .limit(3);

  if (error) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const match = (data ?? [])[0] ?? null;
  if (!match) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json({
    found: true,
    name: match.restaurant_name ?? null,
    address: match.address ?? null,
    lat: match.lat ?? null,
    lng: match.lng ?? null,
  });
}
