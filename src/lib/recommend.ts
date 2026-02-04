export type RestaurantRoomRow = {
  id: number;
  restaurant_name: string;
  room_name: string;
  restaurant_des: string | null;
  room_desc: string | null;
  address: string | null;
  event_type: string | null;
  lat: number | null;
  lng: number | null;
  time: string | null;
  seated_capacity: number | null;
  standing_capacity: number | null;
  privacy_level: string | null;
  noise_level: string | null;
  primary_vibe: string | null;
  vibe_tags: string | null;
  cuisine: string | null;
  a_v: string | null;
  min_spend_estimate: number | null;
  menu_link: string | null;
  contact_email: string | null;
  response_time_notes: string | null;
  room_photo_link: string | null;
  image_paths: string[] | null;
  tax_structure: string | null;
  service_charge_gratuity: string | null;
  cake_fee: string | null;
  corkage_fee: string | null;
  cancellation_policy: string | null;
  deposit_required: string | null;
  payment_terms: string | null;
  notes: string | null;
};

export type SearchInput = {
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  headcount?: number;
  privacyLevel?: string;
  noiseLevel?: string;
  vibe?: string;
  needsAV?: boolean;
  budgetTotal?: number;
};

function distanceMiles(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function scoreRow(row: RestaurantRoomRow, input: SearchInput) {
  let score = 0;
  const reasons: string[] = [];
  let distanceMilesAway: number | null = null;
  let withinRadius: boolean | null = null;

  // distance
  if (input.lat != null && input.lng != null && row.lat != null && row.lng != null) {
    const d = distanceMiles(input.lat, input.lng, row.lat, row.lng);
    distanceMilesAway = d;
    if (input.radiusMiles != null) {
      const radius = input.radiusMiles;
      withinRadius = d <= radius;
      if (withinRadius) {
        score += Math.max(0, 20 - d * 3);
        reasons.push(`${d.toFixed(1)} miles away`);
      } else {
        score -= 50;
        reasons.push(`${d.toFixed(1)} miles away (outside radius)`);
      }
    } else {
<<<<<<< HEAD
      // No radius: keep proximity as a mild positive signal.
=======
      // No radius provided; treat all city matches as in-radius and only reward proximity.
>>>>>>> origin/irene
      withinRadius = true;
      score += Math.max(0, 10 - d);
      reasons.push(`${d.toFixed(1)} miles away`);
    }
  }

  // capacity
  if (input.headcount && row.seated_capacity) {
    if (row.seated_capacity >= input.headcount) {
      score += 20;
      reasons.push(`Seated cap ${row.seated_capacity}`);
    } else {
      score -= 40;
      reasons.push(`Too small for ${input.headcount}`);
    }
  }

  // privacy/noise/vibe
  if (input.privacyLevel && row.privacy_level?.toLowerCase().includes(input.privacyLevel.toLowerCase())) {
    score += 10;
    reasons.push(`Privacy: ${row.privacy_level}`);
  }
  if (input.noiseLevel && row.noise_level?.toLowerCase().includes(input.noiseLevel.toLowerCase())) {
    score += 8;
    reasons.push(`Noise: ${row.noise_level}`);
  }
  const vibeHay = `${row.primary_vibe ?? ""} ${row.vibe_tags ?? ""}`.toLowerCase();
  if (input.vibe && vibeHay.includes(input.vibe.toLowerCase())) {
    score += 8;
    reasons.push(`Vibe match: ${input.vibe}`);
  }

  // AV
  if (input.needsAV) {
    const av = (row.a_v ?? "").toLowerCase();
    if (av.includes("yes") || av.includes("av") || av.includes("projector") || av.includes("mic")) {
      score += 6;
      reasons.push("A/V available");
    } else {
      score -= 5;
      reasons.push("A/V unknown");
    }
  }

  // budget (rough)
  if (input.budgetTotal && row.min_spend_estimate) {
    if (row.min_spend_estimate <= input.budgetTotal) {
      score += 10;
      reasons.push(`Min spend ~$${row.min_spend_estimate}`);
    } else {
      score -= 8;
      reasons.push("Min spend may exceed budget");
    }
  } else if (row.min_spend_estimate) {
    reasons.push(`Min spend ~$${row.min_spend_estimate}`);
  }

  return { score, reasons, distanceMilesAway, withinRadius };
}
