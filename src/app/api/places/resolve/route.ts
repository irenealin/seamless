import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";

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

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing Google Maps API key" }, { status: 500 });
  }

  const query = parsed.data.query.trim();
  const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  url.searchParams.set("query", query);
  url.searchParams.set("key", apiKey);

  const resp = await fetch(url.toString());
  if (!resp.ok) {
    return NextResponse.json({ error: "Places request failed" }, { status: 502 });
  }

  const json = (await resp.json()) as {
    status: string;
    results?: Array<{
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };

  if (json.status !== "OK" || !json.results?.length) {
    return NextResponse.json({ found: false, status: json.status }, { status: 200 });
  }

  const top = json.results[0] ?? {};
  const location = top.geometry?.location ?? {};

  return NextResponse.json({
    found: true,
    name: top.name ?? null,
    address: top.formatted_address ?? null,
    lat: location.lat ?? null,
    lng: location.lng ?? null,
  });
}
