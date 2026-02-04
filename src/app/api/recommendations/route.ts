import { NextResponse } from "next/server";
import { z } from "zod";
import { supabase } from "@/lib/supabaseClient";
import { scoreRow, type RestaurantRoomRow } from "@/lib/recommend";

const InputSchema = z.object({
  lat: z.number().optional(),
  lng: z.number().optional(),
  radiusMiles: z.number().optional(),
  areaLabel: z.string().optional(),
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
      const { score, reasons, distanceMilesAway, withinRadius } = scoreRow(row, parsed.data);
      return { row, score, reasons, distanceMilesAway, withinRadius };
    })
    .sort((a, b) => {
      const hasLocation = parsed.data.lat != null && parsed.data.lng != null;
      if (hasLocation) {
        const hasDistanceA = a.distanceMilesAway != null;
        const hasDistanceB = b.distanceMilesAway != null;
        const radius = parsed.data.radiusMiles;

        const bucket = (hasDistance: boolean, within: boolean | null) => {
          if (!hasDistance) return 2;
          if (radius != null) return within ? 0 : 1;
          return 0;
        };

        const bucketA = bucket(hasDistanceA, a.withinRadius);
        const bucketB = bucket(hasDistanceB, b.withinRadius);
        if (bucketA !== bucketB) return bucketA - bucketB;

        if (hasDistanceA && hasDistanceB) {
          const d = (a.distanceMilesAway ?? 0) - (b.distanceMilesAway ?? 0);
          if (d !== 0) return d;
        }
      }

      return b.score - a.score;
    });

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

  const hasRadius = parsed.data.radiusMiles != null;
  const normalizeReasons = (reasons: string[]) =>
    hasRadius ? reasons : reasons.map((r) => r.replace(" (outside radius)", ""));

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
        restaurant_des: best.row.restaurant_des ?? null,
        primary_vibe: best.row.primary_vibe ?? null,
<<<<<<< HEAD
        cuisine: (best.row as any).cuisine ?? null,
        contact_email: best.row.contact_email ?? null,
        image_paths: best.row.image_paths ?? null,
        score: best.score,
        reasons: normalizeReasons(best.reasons),
=======
        contact_email: best.row.contact_email ?? null,
        image_paths: best.row.image_paths ?? null,
        score: best.score,
        reasons: best.reasons,
>>>>>>> origin/irene
        distanceMiles: best.distanceMilesAway ?? null,
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
        rooms: g.rooms
          .map((x) => ({
            room_name: x.row.room_name ?? null,
            image_paths: x.row.image_paths ?? null,
            room_photo_link: x.row.room_photo_link ?? null,
          }))
          .filter((x) => x.room_name),
        roomsPreview: g.rooms
          .slice(0, 3)
          .map((x) => x.row.room_name)
          .filter(Boolean),
      };
    })
    .sort((a, b) => b.score - a.score);

  const cityTokenRaw = (parsed.data.areaLabel ?? "").split(",")[0]?.trim().toLowerCase();
  const normalize = (value: string) =>
    value
      .toLowerCase()
<<<<<<< HEAD
      .replace(/[^a-z0-9\\s]/g, " ")
      .replace(/\\s+/g, " ")
=======
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
>>>>>>> origin/irene
      .trim();
  const cityToken = cityTokenRaw ? normalize(cityTokenRaw) : "";
  const cityInitials = cityToken
    ? cityToken
        .split(" ")
        .filter(Boolean)
        .map((w) => w[0])
        .join("")
    : "";
  const matchesCity = (address: string | null | undefined) => {
    if (!address || !cityToken) return false;
    const norm = normalize(address);
    if (norm.includes(cityToken)) return true;
    if (cityInitials && norm.split(" ").includes(cityInitials)) return true;
    return false;
  };

<<<<<<< HEAD
  const eligibleForTop3 = restaurants.filter((r) => {
=======
  let eligibleForTop3 = restaurants.filter((r) => {
>>>>>>> origin/irene
    if (parsed.data.radiusMiles != null) {
      return r.distanceMiles != null && r.distanceMiles <= parsed.data.radiusMiles;
    }
    if (cityToken) {
      return matchesCity(r.address);
    }
    return true;
  });
<<<<<<< HEAD
  const eligibleNames = new Set(eligibleForTop3.map((r) => r.restaurant_name));
  const fallbackTop3 =
    !eligibleForTop3.length && restaurants.length ? restaurants.slice(0, 3) : [];

  return NextResponse.json({
    top3: (eligibleForTop3.length ? eligibleForTop3 : fallbackTop3).slice(0, 3),
    others: restaurants
      .filter((r) => !eligibleNames.has(r.restaurant_name))
      .filter((r) => !fallbackTop3.some((f) => f.restaurant_name === r.restaurant_name))
      .slice(0, 12),
=======
  if (!eligibleForTop3.length && cityToken) {
    eligibleForTop3 = restaurants.filter(
      (r) => r.distanceMiles != null && r.distanceMiles <= 15
    );
  }
  const eligibleNames = new Set(eligibleForTop3.map((r) => r.restaurant_name));

  return NextResponse.json({
    top3: eligibleForTop3.slice(0, 3),
    others: restaurants.filter((r) => !eligibleNames.has(r.restaurant_name)).slice(0, 12),
>>>>>>> origin/irene
    countRestaurants: restaurants.length,
    countRooms: rows.length,
  });
}
