"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

export function PlaceSearch({
  onSelect,
  defaultValue = "Palo Alto, CA",
}: {
  onSelect: (x: { lat: number; lng: number; label: string }) => void;
  defaultValue?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    let listener: google.maps.MapsEventListener | undefined;

    (async () => {
      // Load Places library (Autocomplete)
      await loadGoogleMaps(["places"]);

      if (!inputRef.current) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["geocode"],
        fields: ["geometry", "formatted_address", "name"],
      });

      listener = autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const loc = place.geometry?.location;
        if (!loc) return;

        const lat = loc.lat();
        const lng = loc.lng();
        const label = place.formatted_address || place.name || value;

        onSelect({ lat, lng, label });
      });
    })().catch((err) => {
      console.error("Places Autocomplete init failed:", err);
    });

    return () => {
      listener?.remove();
    };
  }, [onSelect, value]);

  return (
    <div>
      <label className="label">Area / Address</label>
      <input
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g., Palo Alto, Stanford University, SoMa SF"
      />
      <div className="small" style={{ marginTop: 6 }}>
        Start typing and choose a suggestion.
      </div>
    </div>
  );
}
