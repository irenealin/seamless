"use client";

import { useMemo, useState } from "react";
import { PlaceSearch } from "@/components/PlaceSearch";
import { GoogleMapPanel } from "@/components/GoogleMapPanel";
import { RestaurantCard } from "@/components/RestaurantCard";

type ApiResp = {
  top3: any[];
  others: any[];
  countRestaurants: number;
  countRooms: number;
  error?: string;
};

export default function DiscoverPage() {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [areaLabel, setAreaLabel] = useState("Palo Alto, CA");

  const [headcount, setHeadcount] = useState("10");
  const [radiusMiles, setRadiusMiles] = useState("5");
  const [budgetTotal, setBudgetTotal] = useState("3000");
  const [needsAV, setNeedsAV] = useState(true);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);

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
      alert("Select an area from the dropdown suggestions first.");
      return;
    }
    setLoading(true);
    setData(null);

    const resp = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: center.lat,
        lng: center.lng,
        radiusMiles: Number(radiusMiles),
        headcount: Number(headcount),
        budgetTotal: Number(budgetTotal),
        needsAV,
        // you can add privacyLevel/noiseLevel/vibe next
      }),
    });

    const json = await resp.json();
    setData(json);
    setLoading(false);
  }

  return (
    <div className="grid2">
      {/* Left: filters + results */}
      <div style={{ display: "grid", gap: 16 }}>
        <div className="card">
          <div className="cardInner">
            <div className="small" style={{ fontWeight: 900 }}>
              Find the closest private dining options
            </div>

            <div className="formGrid" style={{ marginTop: 12 }}>
              <div className="span2">
                <PlaceSearch
                  defaultValue={areaLabel}
                  onSelect={(x) => {
                    setCenter({ lat: x.lat, lng: x.lng });
                    setAreaLabel(x.label);
                    // Don’t auto-search—user clicks button
                  }}
                />
              </div>

              <div>
                <label className="label">Radius (miles)</label>
                <input className="input" value={radiusMiles} onChange={(e) => setRadiusMiles(e.target.value)} />
              </div>

              <div>
                <label className="label">Headcount</label>
                <input className="input" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
              </div>

              <div>
                <label className="label">Budget total ($)</label>
                <input className="input" value={budgetTotal} onChange={(e) => setBudgetTotal(e.target.value)} />
              </div>

              <div className="span3">
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={needsAV} onChange={(e) => setNeedsAV(e.target.checked)} />
                  <span className="small" style={{ fontWeight: 800 }}>Needs A/V</span>
                </label>
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn btnPrimary" onClick={getRecommendations} disabled={loading}>
                {loading ? "Searching..." : "Get recommendations"}
              </button>
              {data?.countRestaurants != null ? (
                <div className="small">
                  Found <b>{data.countRestaurants}</b> restaurants from <b>{data.countRooms}</b> rooms
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

        {/* Results */}
        {data?.top3?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="small" style={{ fontWeight: 900 }}>Top 3 recommendations</div>
            <div className="resultsGrid">
              {data.top3.map((r, i) => (
                <RestaurantCard key={r.restaurant_name} item={r} badge={`Top ${i + 1}`} />
              ))}
            </div>
          </div>
        ) : null}

        {data?.others?.length ? (
          <div style={{ display: "grid", gap: 10 }}>
            <div className="small" style={{ fontWeight: 900 }}>Other good choices</div>
            <div className="resultsGrid">
              {data.others.map((r) => (
                <RestaurantCard key={r.restaurant_name} item={r} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Right: Map */}
      <div style={{ position: "sticky", top: 18, alignSelf: "start" }}>
        {center ? (
          <GoogleMapPanel
            center={center}
            points={points}
            onSelect={(name) => {
              // later: scroll to card / highlight
              console.log("Selected on map:", name);
            }}
          />
        ) : (
          <div className="card">
            <div className="cardInner">
              <div className="small">Select an area to show the map.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
