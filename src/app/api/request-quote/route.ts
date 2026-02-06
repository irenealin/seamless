import { NextResponse } from "next/server";
import { z } from "zod";

const InputSchema = z.object({
  restaurant_name: z.string().min(1),
  contact_email: z.string().email(),
  requirements: z.object({
    areaLabel: z.string().optional(),
    radiusMiles: z.string().optional(),
    headcount: z.string().optional(),
    budgetTotal: z.string().optional(),
    needsAV: z.boolean().optional(),
    eventType: z.string().optional(),
    dateNeeded: z.string().optional(),
    timeNeeded: z.string().optional(),
    privacyLevel: z.string().optional(),
    noiseLevel: z.string().optional(),
    vibe: z.string().optional(),
    maxCakeFee: z.string().optional(),
    maxCorkageFee: z.string().optional(),
  }),
});

function formatRequirements(reqs: z.infer<typeof InputSchema>["requirements"]) {
  const lines: string[] = [];
  if (reqs.areaLabel) lines.push(`Area: ${reqs.areaLabel}`);
  if (reqs.radiusMiles) lines.push(`Radius: ${reqs.radiusMiles} miles`);
  if (reqs.headcount) lines.push(`Headcount: ${reqs.headcount}`);
  if (reqs.budgetTotal) lines.push(`Max budget: $${reqs.budgetTotal}`);
  if (reqs.eventType) lines.push(`Event type: ${reqs.eventType}`);
  if (reqs.dateNeeded) lines.push(`Date: ${reqs.dateNeeded}`);
  if (reqs.timeNeeded) lines.push(`Time needed: ${reqs.timeNeeded}`);
  if (reqs.privacyLevel) lines.push(`Privacy: ${reqs.privacyLevel}`);
  if (reqs.noiseLevel) lines.push(`Noise: ${reqs.noiseLevel}`);
  if (reqs.vibe) lines.push(`Vibe: ${reqs.vibe}`);
  if (reqs.needsAV) lines.push("A/V needed: yes");
  if (reqs.maxCakeFee) lines.push(`Max cake fee: $${reqs.maxCakeFee}`);
  if (reqs.maxCorkageFee) lines.push(`Max corkage fee: $${reqs.maxCorkageFee}`);
  return lines.length ? lines.join("\n") : "No specific requirements provided.";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = InputSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { restaurant_name, contact_email, requirements } = parsed.data;

  const subject = `Quote request — ${restaurant_name}`;
  const emailBody =
    `Hello,\n\n` +
    `We'd like to request a quote for a private dining event at ${restaurant_name}.\n\n` +
    `Requirements:\n${formatRequirements(requirements)}\n\n` +
    `Thanks,\nSeamless`;

  const mailto = `mailto:${encodeURIComponent(contact_email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(emailBody)}`;

  return NextResponse.json({
    ok: true,
    mailto,
    subject,
    body: emailBody,
    to: contact_email,
  });
}
