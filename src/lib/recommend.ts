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
  areaLabel?: string;
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
  let priorityScore = 0;
  let secondaryScore = 0;
  const reasons: string[] = [];
  let distanceMilesAway: number | null = null;
  let withinRadius: boolean | null = null;

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const cityTokenRaw = (input.areaLabel ?? "").split(",")[0]?.trim();
  const cityToken = cityTokenRaw ? normalize(cityTokenRaw) : "";

  // distance
  if (input.lat != null && input.lng != null && row.lat != null && row.lng != null) {
    const d = distanceMiles(input.lat, input.lng, row.lat, row.lng);
    distanceMilesAway = d;
    if (input.radiusMiles != null) {
      const radius = input.radiusMiles;
      withinRadius = d <= radius;
      if (withinRadius) {
        priorityScore += Math.max(0, 60 - d * 5);
        reasons.push(`${d.toFixed(1)} miles away`);
      } else {
        priorityScore -= 80;
        reasons.push(`${d.toFixed(1)} miles away (outside radius)`);
      }
    } else {
      // No radius provided; treat all city matches as in-radius and only reward proximity.
      withinRadius = true;
      priorityScore += Math.max(0, 30 - d * 2);
      reasons.push(`${d.toFixed(1)} miles away`);
    }
  }

  // location label match (when no precise geo or to reinforce city match)
  if (cityToken && row.address) {
    const normAddress = normalize(row.address);
    if (normAddress.includes(cityToken)) {
      priorityScore += 30;
      reasons.push(`Address match: ${cityTokenRaw}`);
    } else {
      priorityScore -= 20;
    }
  }

  // capacity
  if (input.headcount && row.seated_capacity) {
    const diff = row.seated_capacity - input.headcount;
    if (diff >= 0) {
      const closeness = Math.max(0, 40 - diff * 3);
      priorityScore += 40 + closeness;
      if (diff === 0) {
        reasons.push(`Seated cap ${row.seated_capacity} (exact fit)`);
      } else {
        reasons.push(`Seated cap ${row.seated_capacity}`);
      }
    } else {
      priorityScore -= 90 + Math.abs(diff) * 4;
      reasons.push(`Too small for ${input.headcount}`);
    }
  }

  // privacy/noise/vibe
  if (input.privacyLevel && row.privacy_level?.toLowerCase().includes(input.privacyLevel.toLowerCase())) {
    secondaryScore += 6;
    reasons.push(`Privacy: ${row.privacy_level}`);
  }
  if (input.noiseLevel && row.noise_level?.toLowerCase().includes(input.noiseLevel.toLowerCase())) {
    secondaryScore += 5;
    reasons.push(`Noise: ${row.noise_level}`);
  }
  const vibeHay = `${row.primary_vibe ?? ""} ${row.vibe_tags ?? ""}`.toLowerCase();
  if (input.vibe && vibeHay.includes(input.vibe.toLowerCase())) {
    secondaryScore += 6;
    reasons.push(`Vibe match: ${input.vibe}`);
  }

  // AV
  if (input.needsAV) {
    const av = (row.a_v ?? "").toLowerCase();
    if (av.includes("yes") || av.includes("av") || av.includes("projector") || av.includes("mic")) {
      secondaryScore += 15;
      reasons.push("A/V available");
    } else {
      secondaryScore -= 10;
      reasons.push("A/V unknown");
    }
  }

  // budget (rough)
  if (input.budgetTotal && row.min_spend_estimate) {
    if (row.min_spend_estimate <= input.budgetTotal) {
      priorityScore += 35;
      reasons.push(`Min spend ~$${row.min_spend_estimate}`);
    } else {
      priorityScore -= 40;
      reasons.push("Min spend may exceed budget");
    }
  } else if (row.min_spend_estimate) {
    reasons.push(`Min spend ~$${row.min_spend_estimate}`);
  }

  const score = priorityScore + secondaryScore;
  return { score, priorityScore, secondaryScore, reasons, distanceMilesAway, withinRadius };
}
