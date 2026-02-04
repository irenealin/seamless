"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

type Point = {
  restaurant_name: string;
  cuisinePhrase?: string | null;
  distanceMiles?: number | null;
  distanceLabel?: string | null;
  lat: number | null;
  lng: number | null;
};

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
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const escapeHtml = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

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
      if (!infoWindowRef.current) infoWindowRef.current = new google.maps.InfoWindow();

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
          marker.addListener("click", () => {
            const info = marker.get("info") as Point | undefined;
            onSelect?.(info?.restaurant_name ?? p.restaurant_name);
          });
          marker.addListener("mouseover", () => {
            const info = infoWindowRef.current;
            if (!info) return;
            const payload = (marker.get("info") as Point | undefined) ?? p;
            const name = escapeHtml(payload.restaurant_name);
            const cuisinePhrase = payload.cuisinePhrase
              ? `<div style="opacity:0.9; color:#111; font-weight:500;">${escapeHtml(payload.cuisinePhrase)}</div>`
              : "";
            const distanceLine =
              payload.distanceMiles != null
                ? `<div style="opacity:0.85; color:#111; margin-top:6px;">${
                    payload.distanceMiles <= 0.1
                      ? "On-site"
                      : `${payload.distanceMiles.toFixed(1)} mi away`
                  }${payload.distanceLabel ? ` from <span style="font-weight:700; color:#0b5cad;">${escapeHtml(payload.distanceLabel)}</span>` : ""}</div>`
                : "";
            info.setContent(
              `<div style="font-family: ui-sans-serif, system-ui; font-size:12px; color:#111;"><div style="font-weight:700; font-size:13.5px; margin-bottom:4px;">${name}</div>${cuisinePhrase ? `<div style="opacity:0.9; color:#111; font-weight:500;">${escapeHtml(payload.cuisinePhrase)}</div>` : ""}${distanceLine}</div>`
            );
            info.open({ anchor: marker, map });
          });
          marker.addListener("mouseout", () => infoWindowRef.current?.close());
        } else {
          marker.setPosition({ lat: p.lat, lng: p.lng });
          marker.setMap(map);
        }

        marker.set("info", p);
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
