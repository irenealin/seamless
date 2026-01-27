"use client";

import { useEffect, useMemo, useState } from "react";
import { PlaceSearch } from "@/components/PlaceSearch";
import { GoogleMapPanel } from "@/components/GoogleMapPanel";
import { RestaurantCard } from "@/components/RestaurantCard";

type RestaurantResult = {
  restaurant_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  score?: number;
  reasons?: string[];
  distanceMiles?: number | null;

  // top-level extra fields (optional — depends what your API returns)
  restaurant_des?: string | null;
  event_type?: string | null;
  time?: string | null;
  primary_vibe?: string | null;
  vibe_tags?: string | null;

  a_v?: string | null;
  min_spend_estimate?: number | null;

  menu_link?: string | null;
  google_place_id?: string | null;
  yelp_business_id?: string | null;
  contact_email?: string | null;
  response_time_notes?: string | null;
  room_photo_link?: string | null;

  tax_structure?: string | null;
  service_charge_gratuity?: string | null;
  cake_fee?: string | null;
  corkage_fee?: string | null;
  cancellation_policy?: string | null;
  deposit_required?: string | null;
  payment_terms?: string | null;
  notes?: string | null;

  bestRoom?: {
    room_name?: string | null;
    room_desc?: string | null;
    seated_capacity?: number | null;
    standing_capacity?: number | null;
    privacy_level?: string | null;
    noise_level?: string | null;
    a_v?: string | null;
    min_spend_estimate?: number | null;
    room_photo_link?: string | null;
    menu_link?: string | null;
  };

  roomsPreview?: string[];
};

type ApiResp = {
  top3: RestaurantResult[];
  others: RestaurantResult[];
  countRestaurants?: number;
  countRooms?: number;
  count?: number;
  error?: string;
};

export default function DiscoverPage() {
  // Location (from Google Places)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [areaLabel, setAreaLabel] = useState("");

  // Filters (ALL start empty)
  const [radiusMiles, setRadiusMiles] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [needsAV, setNeedsAV] = useState(false);

  const [eventType, setEventType] = useState("");
  const [timeNeeded, setTimeNeeded] = useState("");

  const [privacyLevel, setPrivacyLevel] = useState("");
  const [noiseLevel, setNoiseLevel] = useState("");
  const [vibe, setVibe] = useState("");

  const [maxCakeFee, setMaxCakeFee] = useState("");
  const [maxCorkageFee, setMaxCorkageFee] = useState("");

  // API response state
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [selected, setSelected] = useState<RestaurantResult | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    if (selected) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function getPhotos(item: RestaurantResult) {
    const raw = item?.bestRoom?.room_photo_link ?? "";
    return raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }

  const allResults = useMemo(
    () => [...(data?.top3 ?? []), ...(data?.others ?? [])],
    [data]
  );

  const points = useMemo(
    () =>
      allResults.map((r) => ({
        restaurant_name: r.restaurant_name,
        lat: r.lat,
        lng: r.lng,
      })),
    [allResults]
  );

  async function getRecommendations() {
    if (!center) {
      alert("Please select an area from the dropdown suggestions first.");
      return;
    }

    setLoading(true);
    setData(null);

    // Only send filters that the user filled in
    const payload: any = { lat: center.lat, lng: center.lng };

    if (radiusMiles) payload.radiusMiles = Number(radiusMiles);
    if (headcount) payload.headcount = Number(headcount);
    if (budgetTotal) payload.budgetTotal = Number(budgetTotal);

    if (eventType) payload.eventType = eventType;
    if (timeNeeded) payload.timeNeeded = timeNeeded;

    if (privacyLevel) payload.privacyLevel = privacyLevel;
    if (noiseLevel) payload.noiseLevel = noiseLevel;
    if (vibe) payload.vibe = vibe;

    if (needsAV) payload.needsAV = true;

    if (maxCakeFee) payload.maxCakeFee = Number(maxCakeFee);
    if (maxCorkageFee) payload.maxCorkageFee = Number(maxCorkageFee);

    const resp = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    setData(json);
    setLoading(false);
  }

  return (
    <div className="grid2">
      {/* LEFT: Planner + Results */}
      <div style={{ display: "grid", gap: 16 }}>
        <div className="card">
          <div className="cardInner">
            <div className="small" style={{ fontWeight: 900 }}>
              Tell us what you need — we’ll match you with the best private dining venues.
            </div>

            <div className="formGrid" style={{ marginTop: 12 }}>
              <div className="span2">
                <PlaceSearch
                  defaultValue={areaLabel}
                  onSelect={(x) => {
                    setCenter({ lat: x.lat, lng: x.lng });
                    setAreaLabel(x.label);
                  }}
                />
              </div>

              <div>
                <label className="label">Radius (miles)</label>
                <input
                  className="input"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(e.target.value)}
                  placeholder="e.g., 5"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="label">Headcount</label>
                <input
                  className="input"
                  value={headcount}
                  onChange={(e) => setHeadcount(e.target.value)}
                  placeholder="e.g., 20"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="label">Max budget ($)</label>
                <input
                  className="input"
                  value={budgetTotal}
                  onChange={(e) => setBudgetTotal(e.target.value)}
                  placeholder="e.g., 5000"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="label">Event type</label>
                <input
                  className="input"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  placeholder="e.g., team dinner, client dinner, board meeting"
                />
              </div>

              <div>
                <label className="label">Time needed</label>
                <input
                  className="input"
                  value={timeNeeded}
                  onChange={(e) => setTimeNeeded(e.target.value)}
                  placeholder="e.g., 6pm–9pm"
                />
              </div>

              <div>
                <label className="label">Privacy</label>
                <select
                  className="input"
                  value={privacyLevel}
                  onChange={(e) => setPrivacyLevel(e.target.value)}
                >
                  <option value="">Any privacy</option>
                  <option value="full">Full private</option>
                  <option value="partial">Semi-private</option>
                </select>
              </div>

              <div>
                <label className="label">Noise</label>
                <select
                  className="input"
                  value={noiseLevel}
                  onChange={(e) => setNoiseLevel(e.target.value)}
                >
                  <option value="">Any noise</option>
                  <option value="quiet">Quiet</option>
                  <option value="moderate">Moderate</option>
                  <option value="loud">Loud</option>
                </select>
              </div>

              <div>
                <label className="label">Vibe keyword</label>
                <input
                  className="input"
                  value={vibe}
                  onChange={(e) => setVibe(e.target.value)}
                  placeholder="e.g., upscale, modern, cozy"
                />
              </div>

              <div>
                <label className="label">Max cake fee ($)</label>
                <input
                  className="input"
                  value={maxCakeFee}
                  onChange={(e) => setMaxCakeFee(e.target.value)}
                  placeholder="e.g., 25"
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="label">Max corkage fee ($)</label>
                <input
                  className="input"
                  value={maxCorkageFee}
                  onChange={(e) => setMaxCorkageFee(e.target.value)}
                  placeholder="e.g., 40"
                  inputMode="numeric"
                />
              </div>

              <div className="span3">
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={needsAV}
                    onChange={(e) => setNeedsAV(e.target.checked)}
                  />
                  <span className="small" style={{ fontWeight: 800 }}>
                    Needs A/V
                  </span>
                </label>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" onClick={getRecommendations} disabled={loading}>
                {loading ? "Searching..." : "Get recommendations"}
              </button>

              {data?.countRestaurants != null ? (
                <div className="small">
                  Found <b>{data.countRestaurants}</b> restaurants (from{" "}
                  <b>{data.countRooms}</b> rooms)
                </div>
              ) : data?.count != null ? (
                <div className="small">
                  Scored <b>{data.count}</b> rooms
                </div>
              ) : null}
            </div>

            {data?.error ? (
              <div className="small" style={{ marginTop: 10, color: "crimson" }}>
                Error: {data.error}
              </div>
            ) : null}
          </div>
        </div>

        {/* RESULTS */}
        {data?.top3?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="small" style={{ fontWeight: 900 }}>
              Top 3 recommendations
            </div>
            <div className="resultsGrid">
              {data.top3.map((r, i) => (
                <RestaurantCard
                  key={r.restaurant_name}
                  item={r}
                  badge={`Top ${i + 1}`}
                  onClick={() => setSelected(r)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {data?.others?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="small" style={{ fontWeight: 900 }}>
              Other good choices
            </div>
            <div className="resultsGrid">
              {data.others.map((r) => (
                <RestaurantCard key={r.restaurant_name} item={r} onClick={() => setSelected(r)} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* RIGHT: Map */}
      <div style={{ position: "sticky", top: 18, alignSelf: "start" }}>
        {center ? (
          <GoogleMapPanel
            center={center}
            points={points}
            onSelect={(name) => {
              // optional: scroll to card / highlight later
              console.log("Selected on map:", name);
            }}
          />
        ) : (
          <div className="card">
            <div className="cardInner">
              <div className="small">Select an area to show the map and get recommendations.</div>
            </div>
          </div>
        )}
      </div>

      {selected ? (
        <div className="modalOverlay" onClick={() => setSelected(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modalHeader">
              <div>
                <div className="title">{selected.restaurant_name ?? "Restaurant"}</div>
                <div className="small">{selected.address ?? ""}</div>
              </div>
              <button className="modalClose" onClick={() => setSelected(null)} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modalBody">
              {getPhotos(selected)[0] ? (
                <div className="modalHero">
                  <img src={getPhotos(selected)[0]} alt="" />
                </div>
              ) : null}

              <div className="modalGrid">
                <div>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
                    Best room
                  </div>
                  <div className="small">
                    <b>Name:</b> {selected.bestRoom?.room_name ?? "—"}
                  </div>
                  <div className="small">
                    <b>Capacity:</b> {selected.bestRoom?.seated_capacity ?? "—"} seated
                  </div>
                  <div className="small">
                    <b>Min spend:</b>{" "}
                    {selected.bestRoom?.min_spend_estimate
                      ? `$${selected.bestRoom.min_spend_estimate}`
                      : "—"}
                  </div>
                  <div className="small">
                    <b>A/V:</b> {selected.bestRoom?.a_v ?? "—"}
                  </div>
                </div>

                <div>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
                    Why it matches
                  </div>
                  {(selected.reasons ?? []).length ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(selected.reasons ?? []).map((r) => (
                        <span key={r} className="badge">
                          {r}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="small">No specific reasons listed.</div>
                  )}
                </div>
              </div>

              {(selected.roomsPreview ?? []).length ? (
                <div style={{ marginTop: 14 }}>
                  <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
                    Other rooms
                  </div>
                  <div className="small">{selected.roomsPreview.join(", ")}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
