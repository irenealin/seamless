import { z } from "zod";

const optionalString = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
}, z.string().optional());

const optionalBoolean = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}, z.boolean().optional());

export const RequirementsSchema = z.object({
  areaLabel: optionalString,
  radiusMiles: optionalString,
  headcount: optionalString,
  budgetTotal: optionalString,
  needsAV: optionalBoolean,
  eventType: optionalString,
  dateNeeded: optionalString,
  timeNeeded: optionalString,
  privacyLevel: optionalString,
  noiseLevel: optionalString,
  vibe: optionalString,
  restaurantQuery: optionalString,
  maxCakeFee: optionalString,
  maxCorkageFee: optionalString,
});

export type Requirements = z.infer<typeof RequirementsSchema>;
