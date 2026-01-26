"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type Point = { restaurant_name: string; lat: number | null; lng: number | null };

export function GoogleMapPanel({
  center,
  points,
  onSelect,
}: {
  center: { lat: number; lng: number };
  points: Point[];
  onSelect?: (name: string) => void;
}) {
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());

  useEffect(() => {
    (async () => {
      // Load Maps library (and marker library for future advanced markers)
      await loadGoogleMaps(["maps", "marker"]);

      if (!mapDivRef.current) return;

      // Init map once
      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(mapDivRef.current, {
          center,
          zoom: 12,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
      } else {
        mapRef.current.setCenter(center);
      }

      const map = mapRef.current;

      // Create/update markers
      const next = new Map<string, google.maps.Marker>();

      for (const p of points) {
        if (p.lat == null || p.lng == null) continue;

        let marker = markersRef.current.get(p.restaurant_name);
        if (!marker) {
          marker = new google.maps.Marker({
            position: { lat: p.lat, lng: p.lng },
            map,
            title: p.restaurant_name,
          });
          marker.addListener("click", () => onSelect?.(p.restaurant_name));
        } else {
          marker.setPosition({ lat: p.lat, lng: p.lng });
          marker.setMap(map);
        }

        next.set(p.restaurant_name, marker);
      }

      // Remove markers that are no longer in results
      for (const [name, marker] of markersRef.current.entries()) {
        if (!next.has(name)) marker.setMap(null);
      }
      markersRef.current = next;
    })().catch((err) => {
      console.error("Map init failed:", err);
    });
  }, [center.lat, center.lng, points, onSelect]);

  return (
    <div className="card">
      <div className="cardInner">
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Map</div>
        <div
          ref={mapDivRef}
          style={{
            height: 520,
            borderRadius: 16,
            border: "1px solid var(--border)",
            overflow: "hidden",
            background: "#eef2f7",
          }}
        />
      </div>
    </div>
  );
}
