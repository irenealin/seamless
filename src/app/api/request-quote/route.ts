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
    return NextResponse.json({ error: "Invalid input", details: parsed.error }, { status: 400 });
  }

  const { restaurant_name, contact_email, requirements } = parsed.data;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !port || !user || !pass || !from) {
    return NextResponse.json(
      { error: "Email is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: { user, pass },
    });

    const text = `Hello,\n\nWe'd like to request a quote for a private dining event at ${restaurant_name}.\n\nRequirements:\n${formatRequirements(
      requirements
    )}\n\nThanks,\nSeamless`;

    await transporter.sendMail({
      from,
      to: contact_email,
      subject: `Quote request — ${restaurant_name}`,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to send email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
