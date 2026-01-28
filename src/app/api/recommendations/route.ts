import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { scoreRow, type RestaurantRoomRow } from "@/lib/recommend";

const InputSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusMiles: z.number().optional(),
  headcount: z.number().optional(),
  privacyLevel: z.string().optional(),
  noiseLevel: z.string().optional(),
  vibe: z.string().optional(),
  needsAV: z.boolean().optional(),
  budgetTotal: z.number().optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const { data, error } = await supabase.from("restaurant_rooms").select("*").limit(1000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as RestaurantRoomRow[];

  const ranked = rows
    .map((row) => {
      const { score, reasons } = scoreRow(row, parsed.data);
      return { row, score, reasons };
    })
    .sort((a, b) => b.score - a.score);

  // ✅ ADD THIS BLOCK RIGHT HERE
  const byRestaurant = new Map<
    string,
    { best: (typeof ranked)[number]; rooms: (typeof ranked)[number][] }
  >();

  for (const item of ranked) {
    const name = (item.row.restaurant_name ?? "").trim();
    if (!name) continue;

    const existing = byRestaurant.get(name);
    if (!existing) {
      byRestaurant.set(name, { best: item, rooms: [item] });
    } else {
      existing.rooms.push(item);
      if (item.score > existing.best.score) existing.best = item;
    }
  }

  const restaurants = Array.from(byRestaurant.entries())
    .map(([restaurant_name, g]) => {
      const best = g.best;

      // OPTIONAL: expose distance if your scoreRow returns it in reasons only
      // We'll just pass through reasons and core fields cleanly.
      return {
        restaurant_name,
        address: best.row.address ?? null,
        lat: best.row.lat ?? null,
        lng: best.row.lng ?? null,
        contact_email: best.row.contact_email ?? null,
        score: best.score,
        reasons: best.reasons,
        bestRoom: {
          room_name: best.row.room_name,
          room_desc: best.row.room_desc ?? null,
          seated_capacity: best.row.seated_capacity ?? null,
          standing_capacity: best.row.standing_capacity ?? null,
          privacy_level: best.row.privacy_level ?? null,
          noise_level: best.row.noise_level ?? null,
          a_v: best.row.a_v ?? null,
          min_spend_estimate: best.row.min_spend_estimate ?? null,
          menu_link: best.row.menu_link ?? null,
          room_photo_link: best.row.room_photo_link ?? null,
        },
        roomsPreview: g.rooms
          .slice(0, 3)
          .map((x) => x.row.room_name)
          .filter(Boolean),
      };
    })
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    top3: restaurants.slice(0, 3),
    others: restaurants.slice(3, 15),
    countRestaurants: restaurants.length,
    countRooms: rows.length,
  });
}
