"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlaceSearch } from "@/components/PlaceSearch";
import { GoogleMapPanel } from "@/components/GoogleMapPanel";
import { RestaurantCard } from "@/components/RestaurantCard";

const DEFAULT_CENTER = { lat: 37.4419, lng: -122.143 };
const DEFAULT_AREA_LABEL = "Palo Alto, CA";

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
  image_paths?: string[] | null;

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

  rooms?: Array<{
    room_name?: string | null;
    image_paths?: string[] | null;
    room_photo_link?: string | null;
  }>;

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
  const searchParams = useSearchParams();
  const isExplore = searchParams.get("mode") === "explore";
  // Location (from Google Places)
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    isExplore ? DEFAULT_CENTER : null
  );
  const [areaLabel, setAreaLabel] = useState(isExplore ? DEFAULT_AREA_LABEL : "");

  // Filters (ALL start empty)
  const [radiusMiles, setRadiusMiles] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [budgetTotal, setBudgetTotal] = useState("");
  const [needsAV, setNeedsAV] = useState(false);

  const [eventType, setEventType] = useState("");
  const [timeNeeded, setTimeNeeded] = useState("");
  const [dateNeeded, setDateNeeded] = useState("");

  const [privacyLevel, setPrivacyLevel] = useState("");
  const [noiseLevel, setNoiseLevel] = useState("");
  const [vibe, setVibe] = useState("");

  const [budgetType, setBudgetType] = useState<"total" | "per_head">("total");

  // API response state
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [selected, setSelected] = useState<RestaurantResult | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [showDefaultHeader, setShowDefaultHeader] = useState(true);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightboxSrc) setLightboxSrc(null);
        else setSelected(null);
      }
    }
    if (selected) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, lightboxSrc]);

  useEffect(() => {
    setHeroIndex(0);
  }, [selected]);

  function getPhotos(item: RestaurantResult) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
    const makePublicUrl = (path: string) => {
      if (!supabaseUrl || !bucket) return path;
      const safe = encodeURIComponent(path).replace(/%2F/g, "/");
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${safe}`;
    };

    const fromArray = (item.image_paths ?? [])
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : makePublicUrl(p)));

    if (fromArray.length) return fromArray;

    const raw = item?.bestRoom?.room_photo_link ?? "";
    return raw
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : makePublicUrl(p)));
  }

  function getRoomPhotos(room: { image_paths?: string[] | null; room_photo_link?: string | null }) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET;
    const makePublicUrl = (path: string) => {
      if (!supabaseUrl || !bucket) return path;
      const safe = encodeURIComponent(path).replace(/%2F/g, "/");
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${safe}`;
    };

    const fromArray = (room.image_paths ?? [])
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : makePublicUrl(p)));
    if (fromArray.length) return fromArray;

    const raw = room.room_photo_link ?? "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : makePublicUrl(p)));
  }

  function buildQuoteBody() {
    const lines: string[] = [];
    if (headcount) lines.push(`Capacity: ${headcount} guests`);
    if (privacyLevel) lines.push(`Privacy: ${privacyLevel}`);
    if (noiseLevel) lines.push(`Noise: ${noiseLevel}`);
    if (vibe) lines.push(`Vibe: ${vibe}`);
    if (needsAV) lines.push("A/V: needed");
    if (budgetTotal)
      lines.push(
        `Budget: no more than $${budgetTotal} (${budgetType === "per_head" ? "per head" : "total"})`
      );
    if (eventType) lines.push(`Event type: ${eventType}`);
    if (areaLabel) lines.push(`Area: ${areaLabel}`);
    if (radiusMiles) lines.push(`Radius: ${radiusMiles} miles`);
    return lines.length ? lines.join("\n") : "No specific requirements provided.";
  }

  function requestQuoteDraft(item: RestaurantResult) {
    if (!item.contact_email) {
      alert("No contact email on file for this restaurant.");
      return;
    }

    const dateLabel = dateNeeded || "TBD";
    const subject = `Private Dining at ${item.restaurant_name} - ${dateLabel}`;
    const body = `Hi ${item.restaurant_name} Team,\n\nI'm reaching out to inquire about booking a private dining room on ${dateLabel}. We’re planning an intimate dinner for a group of leaders from top tech companies and would love to host at your beautiful space.\n\nWe are looking for a private, enclosed space${
      headcount ? ` with capacity for ${headcount} guests` : ""
    } at one long table (Chef’s Table style).\n\nTiming: ${timeNeeded || "TBD"}\nDetails:\n${buildQuoteBody()}\n\nPlease let me know if this date is available and if the space can accommodate our group. Thank you!\n`;

    const mailto = `mailto:${encodeURIComponent(
      item.contact_email
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
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

  const allSorted = useMemo(
    () => [...allResults].sort((a, b) => a.restaurant_name.localeCompare(b.restaurant_name)),
    [allResults]
  );

  async function getRecommendations(
    centerOverride?: { lat: number; lng: number },
    opts?: { isDefault?: boolean }
  ) {
    const activeCenter = centerOverride ?? center;
    if (!activeCenter) {
      alert("Please select an area from the dropdown suggestions first.");
      return;
    }
    if (!opts?.isDefault) setShowDefaultHeader(false);

    setLoading(true);
    setData(null);

    // Only send filters that the user filled in
    const payload: any = { lat: activeCenter.lat, lng: activeCenter.lng };

    if (radiusMiles) payload.radiusMiles = Number(radiusMiles);
    if (headcount) payload.headcount = Number(headcount);
    if (budgetTotal) payload.budgetTotal = Number(budgetTotal);
    if (budgetTotal) payload.budgetType = budgetType;

    if (eventType) payload.eventType = eventType;
    if (timeNeeded) payload.timeNeeded = timeNeeded;

    if (privacyLevel) payload.privacyLevel = privacyLevel;
    if (noiseLevel) payload.noiseLevel = noiseLevel;
    if (vibe) payload.vibe = vibe;

    if (needsAV) payload.needsAV = true;

    const resp = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await resp.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    if (isExplore && !data) getRecommendations(DEFAULT_CENTER, { isDefault: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExplore]);

  return (
    <div className="discoverPage">
      <div className="grid2">
        {/* LEFT: Planner */}
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
                <label className="label">Budget type</label>
                <select
                  className="input"
                  value={budgetType}
                  onChange={(e) => setBudgetType(e.target.value as "total" | "per_head")}
                >
                  <option value="total">Total F&amp;B min spend</option>
                  <option value="per_head">Per head</option>
                </select>
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
                <label className="label">Date</label>
                <input
                  className="input"
                  type="date"
                  value={dateNeeded}
                  onChange={(e) => setDateNeeded(e.target.value)}
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
              <button
                className="btn btnPrimary"
                onClick={() => getRecommendations()}
                disabled={loading}
              >
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

        </div>

        {/* RIGHT: Map */}
        <div style={{ alignSelf: "start", display: "grid", gap: 16 }}>
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
      </div>

      {/* RESULTS */}
      {showDefaultHeader ? (
        allSorted.length ? (
          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <div className="sectionTitle">
              {DEFAULT_AREA_LABEL}
            </div>
            <div className="resultsGrid">
              {allSorted.map((r) => (
                <RestaurantCard
                  key={r.restaurant_name}
                  item={r}
                  onClick={() => setSelected(r)}
                />
              ))}
            </div>
          </div>
        ) : null
      ) : (
        <>
          {data?.top3?.length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <div className="sectionTitle sectionTitleDark">
                Top 3 Recommendations
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
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <div className="sectionTitle sectionTitleDark">
                Other Restaurants
              </div>
              <div className="resultsGrid">
                {data.others.map((r) => (
                  <RestaurantCard
                    key={r.restaurant_name}
                    item={r}
                    onClick={() => setSelected(r)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}

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
                  <img
                    src={getPhotos(selected)[heroIndex] ?? getPhotos(selected)[0]}
                    alt=""
                    className="clickableImg"
                    onClick={() =>
                      setLightboxSrc(getPhotos(selected)[heroIndex] ?? getPhotos(selected)[0])
                    }
                  />
                  {getPhotos(selected).length > 1 ? (
                    <div className="heroControls">
                      <button
                        className="heroArrow"
                        onClick={() =>
                          setHeroIndex(
                            (heroIndex - 1 + getPhotos(selected).length) %
                              getPhotos(selected).length
                          )
                        }
                        aria-label="Previous image"
                      >
                        ‹
                      </button>
                      <div className="heroCounter">
                        {heroIndex + 1}/{getPhotos(selected).length}
                      </div>
                      <button
                        className="heroArrow"
                        onClick={() =>
                          setHeroIndex((heroIndex + 1) % getPhotos(selected).length)
                        }
                        aria-label="Next image"
                      >
                        ›
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {getPhotos(selected).length > 1 ? (
                <div className="heroDots">
                  {getPhotos(selected).map((_, i) => (
                    <button
                      key={`dot-${i}`}
                      className={`heroDot ${i === heroIndex ? "isActive" : ""}`}
                      onClick={() => setHeroIndex(i)}
                      aria-label={`Go to image ${i + 1}`}
                    />
                  ))}
                </div>
              ) : null}

              {getPhotos(selected).length > 1 ? (
                <div className="gallery">
                  {getPhotos(selected).slice(1, 9).map((src, i) => (
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      className="clickableImg"
                      onClick={() => setLightboxSrc(src)}
                    />
                  ))}
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

              {(() => {
                const bestName = selected.bestRoom?.room_name ?? "";
                const otherRooms = (selected.rooms ?? []).filter(
                  (r) => r.room_name && r.room_name !== bestName
                );
                return otherRooms.length ? (
                  <div style={{ marginTop: 14 }}>
                    <div className="small" style={{ fontWeight: 800, marginBottom: 6 }}>
                      Other rooms
                    </div>
                    <div className="otherRoomsList">
                      {otherRooms.map((room) => {
                        const photos = getRoomPhotos(room);
                        return (
                          <div key={room.room_name} className="otherRoomItem">
                            <div className="small" style={{ fontWeight: 800 }}>
                              {room.room_name}
                            </div>
                            {photos.length ? (
                              <div className="otherRoomsGallery">
                                {photos.slice(0, 4).map((src, i) => (
                                  <img
                                    key={`${room.room_name}-${src}-${i}`}
                                    src={src}
                                    alt=""
                                    className="clickableImg"
                                    onClick={() => setLightboxSrc(src)}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="small">No images available.</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="row" style={{ marginTop: 16 }}>
                <button className="btn btnPrimary" onClick={() => requestQuoteDraft(selected)}>
                  Request Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {lightboxSrc ? (
        <div className="lightboxOverlay" onClick={() => setLightboxSrc(null)}>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxSrc} alt="" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
