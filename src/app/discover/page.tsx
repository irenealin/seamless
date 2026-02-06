"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PlaceSearch } from "@/components/PlaceSearch";
import { GoogleMapPanel } from "@/components/GoogleMapPanel";
import { RestaurantCard } from "@/components/RestaurantCard";
import type { Requirements } from "@/lib/intakeTypes";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_CENTER = { lat: 37.4419, lng: -122.143 };
const DEFAULT_AREA_LABEL = "Palo Alto, CA";
const REQUIRED_FIELDS = ["areaLabel", "headcount", "budgetTotal"] as const;
const MISSING_LABELS: Record<string, string> = {
  areaLabel: "location",
  headcount: "headcount",
  budgetTotal: "budget",
  dateNeeded: "date",
  timeNeeded: "time",
};

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
  cuisine?: string | null;

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

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse = {
  assistantMessage: string;
  requirements: Requirements;
  isComplete: boolean;
  missing: string[];
};

type SnapshotField = {
  key: keyof Requirements | "location";
  label: string;
  value: string;
  editPrompt: string;
};

function useDebouncedEffect(effect: () => void, deps: unknown[], delayMs: number) {
  useEffect(() => {
    const handle = setTimeout(effect, delayMs);
    return () => clearTimeout(handle);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

function inferAreaLabel(message: string) {
  const text = message.toLowerCase();
  const rules: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\b(sf|san\s+francisco|s\.f\.)\b/i, label: "San Francisco, CA" },
    { pattern: /\b(nyc|new\s+york|new\s+york\s+city)\b/i, label: "New York, NY" },
    { pattern: /\b(la|l\.a\.|los\s+angeles)\b/i, label: "Los Angeles, CA" },
    { pattern: /\b(chicago)\b/i, label: "Chicago, IL" },
    { pattern: /\b(boston)\b/i, label: "Boston, MA" },
    { pattern: /\b(seattle)\b/i, label: "Seattle, WA" },
    { pattern: /\b(miami)\b/i, label: "Miami, FL" },
    { pattern: /\b(austin)\b/i, label: "Austin, TX" },
    { pattern: /\b(denver)\b/i, label: "Denver, CO" },
    { pattern: /\b(dallas)\b/i, label: "Dallas, TX" },
    { pattern: /\b(houston)\b/i, label: "Houston, TX" },
  ];
  for (const rule of rules) {
    if (rule.pattern.test(text)) return rule.label;
  }
  return null;
}

function DiscoverPageContent() {
  const searchParams = useSearchParams();
  const isExplore = searchParams.get("mode") === "explore";
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    isExplore ? DEFAULT_CENTER : null
  );
  const [requirements, setRequirements] = useState<Requirements>(() =>
    isExplore ? { areaLabel: DEFAULT_AREA_LABEL } : {}
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Welcome to Seamless! Happy to help you find your next private dining room. To get started, tell me about your event — location, headcount, budget, and desired vibe. I’ll ask follow-ups if needed.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const lastUpdatedRef = useRef<Requirements>({});
  const [lastUpdatedField, setLastUpdatedField] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<SnapshotField["key"] | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [budgetMode, setBudgetMode] = useState<"total" | "perHead">("total");

  // API response state
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResp | null>(null);
  const [selected, setSelected] = useState<RestaurantResult | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxItems, setLightboxItems] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [showDefaultHeader, setShowDefaultHeader] = useState(true);
  const [roomIndexes, setRoomIndexes] = useState<Record<string, number>>({});
  const [refreshTick, setRefreshTick] = useState(0);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastManualAreaLabelRef = useRef<string | null>(null);
  const lastGeocodedAreaLabelRef = useRef<string | null>(null);

  function setCardRef(name: string) {
    return (el: HTMLDivElement | null) => {
      if (!el) {
        cardRefs.current.delete(name);
        return;
      }
      cardRefs.current.set(name, el);
    };
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightboxSrc) {
          setLightboxSrc(null);
          setLightboxItems([]);
        } else {
          setSelected(null);
        }
      }
      if (lightboxSrc && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        setLightboxIndex((prev) =>
          lightboxItems.length ? (prev + dir + lightboxItems.length) % lightboxItems.length : prev
        );
      }
    }
    if (selected) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, lightboxSrc, lightboxItems.length]);

  useEffect(() => {
    if (lightboxItems.length) {
      setLightboxSrc(lightboxItems[lightboxIndex] ?? lightboxItems[0] ?? null);
    }
  }, [lightboxIndex, lightboxItems]);

  function openLightbox(items: string[], index: number) {
    if (!items.length) return;
    setLightboxItems(items);
    setLightboxIndex(index);
    setLightboxSrc(items[index] ?? items[0]);
  }

  useEffect(() => {
    if (!selected) {
      setRoomIndexes({});
      return;
    }
    const next: Record<string, number> = {};
    for (const room of selected.rooms ?? []) {
      if (room.room_name) next[room.room_name] = 0;
    }
    setRoomIndexes(next);
  }, [selected]);

  useEffect(() => {
    if (isExplore && !requirements.areaLabel) {
      setRequirements((prev) => ({ ...prev, areaLabel: DEFAULT_AREA_LABEL }));
    }
  }, [isExplore, requirements.areaLabel]);

  useEffect(() => {
    const label = requirements.areaLabel?.trim();
    if (!label) return;

    if (label === lastManualAreaLabelRef.current) {
      lastGeocodedAreaLabelRef.current = label;
      return;
    }

    if (label === lastGeocodedAreaLabelRef.current && center) return;

    let cancelled = false;

    (async () => {
      try {
        await loadGoogleMaps(["maps"]);
        const geocoder = new google.maps.Geocoder();
        const { results } = await geocoder.geocode({ address: label });
        const loc = results?.[0]?.geometry?.location;
        if (!loc || cancelled) return;
        setCenter({ lat: loc.lat(), lng: loc.lng() });
        lastGeocodedAreaLabelRef.current = label;
      } catch (err) {
        console.error("Failed to geocode area label:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requirements.areaLabel, center]);

  useEffect(() => {
    const missingNext = REQUIRED_FIELDS.filter((field) => {
      const value = requirements[field];
      return !value || (typeof value === "string" && value.trim() === "");
    }).map((field) => field.toString());
    setMissing(missingNext);
    setIsComplete(missingNext.length === 0);
  }, [requirements]);

  useEffect(() => {
    const prev = lastUpdatedRef.current;
    const keys = Object.keys(requirements) as Array<keyof Requirements>;
    const changed = keys.find((k) => requirements[k] !== prev[k]);
    if (changed) {
      setLastUpdatedField(changed);
      const timer = setTimeout(() => setLastUpdatedField(null), 500);
      lastUpdatedRef.current = requirements;
      return () => clearTimeout(timer);
    }
    lastUpdatedRef.current = requirements;
  }, [requirements]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  function startInlineEdit(field: SnapshotField["key"], value: string) {
    setEditingField(field);
    setEditingValue(value);
  }

  function commitInlineEdit(field: SnapshotField["key"], value: string) {
    const nextValue = value.trim();
    setRequirements((prev) => {
      const next = { ...prev };
      if (field === "location") {
        if (nextValue) next.areaLabel = nextValue;
        else delete next.areaLabel;
        return next;
      }
      if (field === "budgetTotal" && budgetMode === "perHead") {
        const perHead = parseNumber(nextValue);
        const headcount = parseNumber(prev.headcount ?? "");
        if (perHead != null && headcount != null) {
          next.budgetTotal = String(Math.round(perHead * headcount));
          return next;
        }
      }
      if (!nextValue) {
        delete next[field as keyof Requirements];
        return next;
      }
      (next as Record<string, unknown>)[field] = nextValue;
      return next;
    });
    if (field === "budgetTotal" && budgetMode === "perHead") {
      setBudgetMode("total");
    }
    setRefreshTick((prev) => prev + 1);
    setEditingField(null);
  }

  function parseNumber(value: string | null | undefined) {
    if (!value) return null;
    const match = value.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
  }

  function extractPerPersonAmount(text: string) {
    const match = text.match(/(\d+(?:\.\d+)?)\s*(?:per\s*(person|head|guest)|pp)\b/i);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
  }

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

  function cycleRoom(roomName: string, dir: 1 | -1, total: number) {
    if (!total) return;
    setRoomIndexes((prev) => {
      const next = { ...prev };
      const current = prev[roomName] ?? 0;
      next[roomName] = (current + dir + total) % total;
      return next;
    });
  }

  function buildQuoteBody() {
    const headcount = requirements.headcount ?? "";
    const budgetTotal = requirements.budgetTotal ?? "";
    const needsAV = requirements.needsAV ?? false;
    const eventType = requirements.eventType ?? "";
    const dateNeeded = requirements.dateNeeded ?? "";
    const timeNeeded = requirements.timeNeeded ?? "";
    const privacyLevel = requirements.privacyLevel ?? "";
    const noiseLevel = requirements.noiseLevel ?? "";
    const vibe = requirements.vibe ?? "";
    const maxCakeFee = requirements.maxCakeFee ?? "";
    const maxCorkageFee = requirements.maxCorkageFee ?? "";

    const parts: string[] = [];
    const dateText = dateNeeded ? `on ${dateNeeded}` : "";
    const timeText = timeNeeded ? `at ${timeNeeded}` : "";
    const dateTime = [dateText, timeText].filter(Boolean).join(" ");

    if (eventType) parts.push(`a ${eventType}`);
    if (headcount) parts.push(`for about ${headcount} guests`);
    if (dateTime) parts.push(`scheduled ${dateTime}`);

    const preferences: string[] = [];
    if (privacyLevel) preferences.push(`${privacyLevel.toLowerCase()} setup`);
    if (noiseLevel) preferences.push(`${noiseLevel.toLowerCase()} noise level`);
    // Intentionally omit vibe from outbound email.

    const extras: string[] = [];
    if (needsAV) extras.push("A/V support");
    if (maxCakeFee) extras.push(`a cake fee no more than $${maxCakeFee}`);
    if (maxCorkageFee) extras.push(`corkage capped at $${maxCorkageFee}`);

    const intro = parts.length
      ? `We're planning ${parts.join(" ")}.`
      : "We're planning a private dining event.";
    const prefLine = preferences.length
      ? `We prefer a ${preferences.join(", ")}.`
      : "";
    const extraLine = extras.length ? `We'd also like ${extras.join(", ")}.` : "";

    return [intro, prefLine, extraLine].filter(Boolean).join(" ");
  }

  function requestQuoteDraft(item: RestaurantResult) {
    if (!item.contact_email) {
      alert("No contact email on file for this restaurant.");
      return;
    }
    const contactValue = item.contact_email.trim();

    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content?.trim() ?? "";
    const normalizeSentence = (value: string) => {
      const cleaned = value.replace(/\s+/g, " ").trim();
      if (!cleaned) return "";
      return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    };
    const stripYear = (value: string) => value.replace(/,?\s*\b(19|20)\d{2}\b/g, "").trim();
    const headcount = requirements.headcount ?? "";
    const dateNeeded = requirements.dateNeeded ? stripYear(requirements.dateNeeded) : "";
    const timeNeeded = requirements.timeNeeded ?? "";
    const dateLabel = dateNeeded || "[DATE]";
    const timeLabel = timeNeeded || "[TIME]";
    const dateTimeLine =
      dateNeeded && timeNeeded ? `${dateNeeded} at ${timeNeeded}` : `${dateLabel} at ${timeLabel}`;
    const subject = `Private Dining at ${item.restaurant_name} - ${dateLabel}`;
    const body = `Hi ${item.restaurant_name} Team,\n\nI'm reaching out to inquire about booking a private dining room at ${item.restaurant_name} on ${dateLabel}. ${buildQuoteBody()} Timing: ${dateTimeLine}. Please let me know if this date is available and if the space can accommodate our group. Thank you!\n`;

    const mailto = `mailto:${encodeURIComponent(
      contactValue
    )}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    void trackCtaEvent("request_quote", item.restaurant_name ?? null).finally(() => {
      window.location.href = mailto;
    });
  }

  function viewVenue(item: RestaurantResult) {
    setSelected(item);
    void trackCtaEvent("view_venue", item.restaurant_name ?? null);
  }

  function getSessionId() {
    if (typeof window === "undefined") return null;
    const key = "seamless_session_id";
    let value = window.localStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      window.localStorage.setItem(key, value);
    }
    return value;
  }

  function getStoredEmail() {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem("seamless_booker_email");
    if (!raw) return null;
    const email = raw.trim().toLowerCase();
    return email || null;
  }

  async function trackCtaEvent(eventType: "view_venue" | "request_quote", venueId: string | null) {
    try {
      const sessionId = getSessionId();
      const email = getStoredEmail();
      await supabase.from("cta_events").insert({
        event_type: eventType,
        page: "discover",
        venue_id: venueId,
        email,
        session_id: sessionId,
      });
    } catch (err) {
      console.error("CTA event insert failed:", err);
    }
  }

  async function sendMessage() {
    if (isSending) return;
    const text = draft.trim();
    if (!text) return;

    setIsSending(true);
    setDraft("");

    const userMessage: ChatMessage = { role: "user", content: text };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const resp = await fetch("/api/intake/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, current: requirements }),
      });

      const json = (await resp.json()) as ChatResponse;
      if (!resp.ok) {
        const message = (json as any)?.assistantMessage || (json as any)?.error || "Request failed";
        throw new Error(message);
      }

      setMessages([
        ...nextMessages,
        { role: "assistant", content: json.assistantMessage || "Thanks! Let me check that." },
      ]);
      const inferredArea = inferAreaLabel(text);
      const lowerText = text.toLowerCase();
      const mentionsPerPerson =
        /\bper\s*(person|head|guest|pp)\b/.test(lowerText) || /\bpp\b/.test(lowerText);
      const mentionsBudget = /\bbudget\b/.test(lowerText) || /\$[0-9]/.test(lowerText);
      if (json.requirements || inferredArea) {
        let mergedSnapshot: Requirements | null = null;
        setRequirements((prev) => {
          const merged = { ...prev, ...(json.requirements ?? {}) };
          if (inferredArea) merged.areaLabel = inferredArea;
          mergedSnapshot = merged;
          return merged;
        });
        if (mentionsPerPerson) {
          const merged = mergedSnapshot ?? requirements;
          const perHeadFromText = extractPerPersonAmount(text);
          if (perHeadFromText != null) {
            const headcount = parseNumber(merged.headcount ?? "");
            if (headcount != null) {
              setRequirements((prev) => ({
                ...prev,
                budgetTotal: String(Math.round(perHeadFromText * headcount)),
              }));
              setBudgetMode("total");
            } else {
              setBudgetMode("perHead");
            }
          } else if (json.requirements?.budgetTotal) {
            const perHead = parseNumber(json.requirements.budgetTotal);
            const headcount = parseNumber(merged.headcount ?? "");
            if (perHead != null && headcount != null) {
              setRequirements((prev) => ({
                ...prev,
                budgetTotal: String(Math.round(perHead * headcount)),
              }));
              setBudgetMode("total");
            } else {
              setBudgetMode("perHead");
            }
          } else {
            setBudgetMode("perHead");
          }
        } else if (mentionsBudget || json.requirements?.budgetTotal) {
          setBudgetMode("total");
        }
        setRefreshTick((prev) => prev + 1);
      }
      if (Array.isArray(json.missing)) setMissing(json.missing);
      if (typeof json.isComplete === "boolean") setIsComplete(json.isComplete);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `Sorry — I hit an issue (${message}). Please try again or rephrase.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  const allResults = useMemo(
    () => [...(data?.top3 ?? []), ...(data?.others ?? [])],
    [data]
  );

  const points = useMemo(
    () =>
      allResults.map((r) => ({
        restaurant_name: r.restaurant_name,
        cuisinePhrase: r.cuisine ?? null,
        distanceMiles: r.distanceMiles ?? null,
        distanceLabel: requirements.areaLabel ?? null,
        lat: r.lat,
        lng: r.lng,
      })),
    [allResults, requirements.areaLabel]
  );

  const allSorted = useMemo(
    () => [...allResults].sort((a, b) => a.restaurant_name.localeCompare(b.restaurant_name)),
    [allResults]
  );

  async function getRecommendations(
    centerOverride?: { lat: number; lng: number },
    opts?: { isDefault?: boolean }
  ) {
    let activeCenter = centerOverride ?? center;
    if (!activeCenter && requirements.areaLabel) {
      try {
        await loadGoogleMaps(["maps"]);
        const geocoder = new google.maps.Geocoder();
        const { results } = await geocoder.geocode({ address: requirements.areaLabel });
        const loc = results?.[0]?.geometry?.location;
        if (loc) {
          activeCenter = { lat: loc.lat(), lng: loc.lng() };
          setCenter(activeCenter);
        }
      } catch (err) {
        console.error("Failed to geocode area label for recommendations:", err);
      }
    }
    if (!activeCenter) {
      alert("Please select an area from the dropdown suggestions first.");
      return;
    }
    if (!opts?.isDefault) setShowDefaultHeader(false);

    setLoading(true);

    // Only send filters that the user filled in
    const payload: any = {
      lat: activeCenter.lat,
      lng: activeCenter.lng,
      areaLabel: requirements.areaLabel ?? undefined,
    };

    const parseNumber = (value?: string) => {
      if (!value) return undefined;
      const cleaned = value.replace(/[^0-9.]/g, "");
      const num = Number(cleaned);
      return Number.isFinite(num) ? num : undefined;
    };

    const radiusMiles = parseNumber(requirements.radiusMiles);
    const headcount = parseNumber(requirements.headcount);
    const budgetTotal = parseNumber(requirements.budgetTotal);

    if (radiusMiles != null) payload.radiusMiles = radiusMiles;
    if (headcount != null) payload.headcount = headcount;
    if (budgetTotal != null) payload.budgetTotal = budgetTotal;

    if (requirements.eventType) payload.eventType = requirements.eventType;
    if (requirements.dateNeeded) payload.dateNeeded = requirements.dateNeeded;
    if (requirements.timeNeeded) payload.timeNeeded = requirements.timeNeeded;

    if (requirements.privacyLevel) payload.privacyLevel = requirements.privacyLevel;
    if (requirements.noiseLevel) payload.noiseLevel = requirements.noiseLevel;
    if (requirements.vibe) payload.vibe = requirements.vibe;
    if (requirements.needsAV) payload.needsAV = true;
    if (requirements.maxCakeFee) payload.maxCakeFee = Number(requirements.maxCakeFee);
    if (requirements.maxCorkageFee) payload.maxCorkageFee = Number(requirements.maxCorkageFee);

    const resp = await fetch("/api/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let json: ApiResp | null = null;
    const contentType = resp.headers.get("content-type") ?? "";
    const rawText = await resp.text();
    if (contentType.includes("application/json") && rawText) {
      try {
        json = JSON.parse(rawText) as ApiResp;
      } catch {
        console.error("Recommendations returned invalid JSON:", rawText.slice(0, 200));
      }
    } else if (rawText) {
      console.error("Recommendations returned non-JSON:", rawText.slice(0, 200));
    }
    if (!resp.ok || !json) {
      console.error("Recommendations request failed:", resp.status, resp.statusText);
      setLoading(false);
      return;
    }
    setData(json);
    setLoading(false);
  }

  const missingRequired = REQUIRED_FIELDS.filter((field) => {
    const value = requirements[field];
    return !value || (typeof value === "string" && value.trim() === "");
  });

  useDebouncedEffect(() => {
    if (!center) return;
    if (missingRequired.length) return;
    getRecommendations();
  }, [center?.lat, center?.lng, requirements, missingRequired.length, refreshTick], 450);

  return (
    <div className="discoverPage">
      <div className="discoverGrid">
        {/* LEFT: AI Intake Chat */}
        <div className="stickyColumn conciergePanel" style={{ display: "grid", gap: 12 }}>
          <div className="card conciergeCard">
            <div className="cardInner">
              <div style={{ display: "grid", gap: 4 }}>
                <div className="sectionTitle">AI Concierge</div>
                <div className="small">
                  Describe your event and I’ll update your live snapshot in real time.
                </div>
              </div>

              <div
                style={{
                  marginTop: 10,
                  height: 350,
                  borderRadius: 14,
                  border: "1px solid transparent",
                  background: "transparent",
                  overflow: "hidden",
                }}
              >
                <div
                  className="conciergeScroll"
                  style={{
                    height: "100%",
                    overflowY: "auto",
                    padding: 10,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    justifyContent: "flex-start",
                  }}
                >
                  {messages.map((msg, idx) => (
                    <div
                      key={`${msg.role}-${idx}`}
                      style={{
                        display: "flex",
                        justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "85%",
                          padding: "10px 12px",
                          borderRadius: 14,
                          border: "1px solid var(--border)",
                          background:
                            msg.role === "user"
                              ? "rgba(201, 163, 106, 0.18)"
                              : "rgba(255, 255, 255, 0.06)",
                        }}
                      >
                        <div className="small" style={{ whiteSpace: "pre-wrap" }}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>

              <div style={{ marginTop: 2, display: "grid", gap: 8, paddingBottom: 6 }}>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Paste a paragraph or type a message..."
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  ref={draftRef}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <div className="row">
                  <button
                    className="btn btnPrimary"
                    onClick={sendMessage}
                    disabled={isSending}
                  >
                    {isSending ? "Sending..." : "Send"}
                  </button>
                  <div className="small">Shift+Enter for a new line.</div>
                </div>
              </div>
            </div>
          </div>

          {center ? (
            <GoogleMapPanel
              center={center}
              points={points}
              onSelect={(name) => {
                const match = allResults.find((r) => r.restaurant_name === name) ?? null;
                setSelected(match);
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
        {/* RIGHT: Snapshot + Map + Results */}
        <div className="mapColumn">
          <div className="card snapshotStrip">
            <div className="cardInner">
              <div className="sectionTitle">Live Event Snapshot</div>

              <div className="snapshotStripBody">
                <PlaceSearch
                  defaultValue={
                    requirements.areaLabel || (isExplore ? DEFAULT_AREA_LABEL : "")
                  }
                  onSelect={(x) => {
                    lastManualAreaLabelRef.current = x.label;
                    lastGeocodedAreaLabelRef.current = x.label;
                    setCenter({ lat: x.lat, lng: x.lng });
                    setRequirements((prev) => ({ ...prev, areaLabel: x.label }));
                  }}
                />

                <div className="snapshotStripFields">
                  {(
                  [
                    {
                      key: "headcount",
                      label: "Guests",
                      value: requirements.headcount ?? "",
                      editPrompt: "Set headcount to 12 people.",
                    },
                    {
                      key: "budgetTotal",
                      label: "Budget",
                      value: requirements.budgetTotal ?? "",
                      editPrompt: "Budget is around $4000 total.",
                    },
                    {
                      key: "dateNeeded",
                      label: "Date",
                      value: requirements.dateNeeded ?? "",
                      editPrompt: "The date is Feb 10.",
                    },
                    {
                      key: "timeNeeded",
                      label: "Time",
                      value: requirements.timeNeeded ?? "",
                      editPrompt: "Set time to 6:30pm.",
                    },
                    {
                      key: "privacyLevel",
                      label: "Privacy",
                      value: requirements.privacyLevel ?? "",
                      editPrompt: "We need a fully private room.",
                    },
                    {
                      key: "radiusMiles",
                      label: "Radius",
                      value: requirements.radiusMiles ?? "",
                      editPrompt: "Set radius to 2 miles.",
                    },
                    {
                      key: "noiseLevel",
                      label: "Noise",
                      value: requirements.noiseLevel ?? "",
                      editPrompt: "We want it to be quiet.",
                    },
                    {
                      key: "eventType",
                      label: "Event type",
                      value: requirements.eventType ?? "",
                      editPrompt: "This is a team dinner.",
                    },
                  ] as SnapshotField[]
                ).map((row) => (
                  <div
                    key={row.label}
                    className={`snapshotRow snapshotStripItem${
                      lastUpdatedField === row.key ? " isUpdated" : ""
                    }`}
                  >
                    <div className="snapshotStripContent">
                      <div className="snapshotStripLabel">{row.label}</div>
                      {editingField === row.key ? (
                        <div className="snapshotStripInputRow">
                          {row.key === "budgetTotal" ? (
                            <span className="snapshotStripCurrency">$</span>
                          ) : null}
                          <input
                            className="input snapshotStripInput"
                            value={editingValue}
                            autoFocus
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitInlineEdit(row.key, editingValue);
                              }
                              if (e.key === "Escape") {
                                setEditingField(null);
                              }
                            }}
                            onBlur={() => commitInlineEdit(row.key, editingValue)}
                          />
                        </div>
                      ) : (
                        <div className="snapshotStripValue">
                          {row.value
                            ? row.key === "budgetTotal"
                              ? (() => {
                                  const budget = parseNumber(row.value);
                                  if (budget == null) return `$${row.value} total`;
                                  return `$${budget} total`;
                                })()
                              : row.value
                            : "Not specified"}
                        </div>
                      )}
                    </div>
                    {row.key === "budgetTotal" && editingField === row.key ? (
                      <div className="snapshotStripToggle">
                        <button
                          type="button"
                          className={`snapshotToggleBtn ${
                            budgetMode === "total" ? "isActive" : ""
                          }`}
                          onClick={() => setBudgetMode("total")}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-pressed={budgetMode === "total"}
                        >
                          Total
                        </button>
                        <button
                          type="button"
                          className={`snapshotToggleBtn ${
                            budgetMode === "perHead" ? "isActive" : ""
                          }`}
                          onClick={() => setBudgetMode("perHead")}
                          onMouseDown={(e) => e.preventDefault()}
                          aria-pressed={budgetMode === "perHead"}
                        >
                          Per person
                        </button>
                      </div>
                    ) : (
                      <span className="snapshotStripSpacer" />
                    )}
                    <button
                      className="btn btnGhost snapshotStripEdit"
                      onClick={() =>
                        editingField === row.key
                          ? commitInlineEdit(row.key, editingValue)
                          : startInlineEdit(row.key, row.value)
                      }
                      aria-label={`Edit ${row.label}`}
                    >
                      {editingField === row.key ? "✓" : "✎"}
                    </button>
                  </div>
                ))}
                </div>

                <div className="small" style={{ color: "var(--muted)" }}>
                  {!requirements.areaLabel
                    ? "Please type the location you’re interested in into the area/address box in Live Event Snapshot to start recommendations."
                    : missingRequired.length
                      ? `Need: ${missingRequired.map((f) => MISSING_LABELS[f] ?? f).join(", ")}`
                      : loading
                        ? "Updating results…"
                        : "Results are up to date."}
                </div>
                <button
                  className="btn btnGhost"
                  onClick={() => getRecommendations()}
                  disabled={!center || loading}
                >
                  Refresh results
                </button>

                {data?.error ? (
                  <div className="small" style={{ marginTop: 6, color: "crimson" }}>
                    Error: {data.error}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {showDefaultHeader ? (
            allSorted.length ? (
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <div className="sectionTitle">{DEFAULT_AREA_LABEL}</div>
                <div className="resultsGrid">
                  {allSorted.map((r) => (
                    <div key={r.restaurant_name} ref={setCardRef(r.restaurant_name)}>
                      <RestaurantCard item={r} onClick={() => viewVenue(r)} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          ) : (
            <>
              {data?.top3?.length ? (
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  <div
                    className="sectionTitle sectionTitleDark"
                    style={{ fontWeight: 800 }}
                  >
                    Top Recommendations
                  </div>
                  <div className="resultsGrid">
                    {data.top3.map((r, i) => (
                      <div key={r.restaurant_name} ref={setCardRef(r.restaurant_name)}>
                        <RestaurantCard
                          item={r}
                          badge={i < 3 ? `Top ${i + 1}` : undefined}
                          onClick={() => viewVenue(r)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {data?.others?.length ? (
                <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                  <div
                    className="sectionTitle sectionTitleDark"
                    style={{ fontWeight: 800 }}
                  >
                    Other Restaurants
                  </div>
                  <div className="resultsGrid">
                    {data.others.map((r) => (
                      <div key={r.restaurant_name} ref={setCardRef(r.restaurant_name)}>
                        <RestaurantCard item={r} onClick={() => viewVenue(r)} />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
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
              {getPhotos(selected).length > 1 ? (
                <div className="gallery">
                  {getPhotos(selected).slice(1, 9).map((src, i) => (
                    <img
                      key={`${src}-${i}`}
                      src={src}
                      alt=""
                      className="clickableImg"
                      onClick={() => openLightbox(getPhotos(selected), i + 1)}
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
                        const roomName = room.room_name ?? "";
                        const activeIndex = roomName ? (roomIndexes[roomName] ?? 0) : 0;
                        const activeSrc = photos[activeIndex] ?? photos[0];
                        return (
                          <div key={room.room_name} className="otherRoomItem">
                            <div className="small" style={{ fontWeight: 800 }}>
                              {room.room_name}
                            </div>
                            {photos.length ? (
                              <div className="roomCarousel">
                                <button
                                  className="roomArrow left"
                                  onClick={() => cycleRoom(roomName, -1, photos.length)}
                                  aria-label="Previous image"
                                >
                                  ‹
                                </button>
                                <div
                                  className="roomSquare"
                                  onClick={() =>
                                    activeSrc && openLightbox(photos, activeIndex)
                                  }
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && activeSrc)
                                      openLightbox(photos, activeIndex);
                                  }}
                                >
                                  {activeSrc ? (
                                    <img src={activeSrc} alt="" />
                                  ) : (
                                    <div className="small">No images available.</div>
                                  )}
                                </div>
                                <button
                                  className="roomArrow right"
                                  onClick={() => cycleRoom(roomName, 1, photos.length)}
                                  aria-label="Next image"
                                >
                                  ›
                                </button>
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
        <div
          className="lightboxOverlay"
          onClick={() => {
            setLightboxSrc(null);
            setLightboxItems([]);
          }}
        >
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxItems[lightboxIndex] ?? lightboxSrc} alt="" />
            {lightboxItems.length > 1 ? (
              <div className="lightboxControls">
                <button
                  className="lightboxArrow"
                  onClick={() =>
                    setLightboxIndex(
                      (lightboxIndex - 1 + lightboxItems.length) % lightboxItems.length
                    )
                  }
                  aria-label="Previous image"
                >
                  ‹
                </button>
                <div className="lightboxCounter">
                  {lightboxIndex + 1}/{lightboxItems.length}
                </div>
                <button
                  className="lightboxArrow"
                  onClick={() =>
                    setLightboxIndex((lightboxIndex + 1) % lightboxItems.length)
                  }
                  aria-label="Next image"
                >
                  ›
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverPageContent />
    </Suspense>
  );
}
