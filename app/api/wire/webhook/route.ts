import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIGNATURE_AGE_SECONDS = 300;

type WireEvent = {
  id?: string;
  type?: string;
  data?: {
    id?: string;
    object?: { id?: string; metadata?: Record<string, unknown> } | string;
    payment_intent?: { id?: string; metadata?: Record<string, unknown> } | string;
    metadata?: Record<string, unknown>;
  };
};

function parseSignature(value: string | null) {
  if (!value) return null;
  const parts = new Map(
    value.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  const timestamp = Number(parts.get("t"));
  const signature = parts.get("v1");
  if (!Number.isFinite(timestamp) || !signature) return null;
  return { timestamp, signature };
}

function signaturesMatch(expected: string, received: string) {
  if (!/^[a-f0-9]+$/i.test(received)) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "duu-taaya-wire-webhook",
    configured: Boolean(process.env.WIRE_WEBHOOK_SECRET),
  });
}

export async function POST(request: Request) {
  const secret = process.env.WIRE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Webhook secret is not configured" },
      { status: 503 },
    );
  }

  const parsed = parseSignature(request.headers.get("WirePayment-Signature"));
  if (!parsed) {
    return NextResponse.json(
      { ok: false, error: "Missing or invalid signature" },
      { status: 401 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    parsed.timestamp > now + 30 ||
    now - parsed.timestamp > MAX_SIGNATURE_AGE_SECONDS
  ) {
    return NextResponse.json(
      { ok: false, error: "Expired signature" },
      { status: 401 },
    );
  }

  const rawBody = await request.text();
  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${rawBody}`)
    .digest("hex");

  if (!signaturesMatch(expected, parsed.signature)) {
    return NextResponse.json(
      { ok: false, error: "Signature verification failed" },
      { status: 401 },
    );
  }

  let event: WireEvent;
  try {
    event = JSON.parse(rawBody) as WireEvent;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  console.info("Wire webhook verified", {
    eventId: event.id ?? "unknown",
    type: event.type ?? "unknown",
  });

  if (event.type === "payment_intent.succeeded") {
    console.info("Duu Taaya donation succeeded", {
      eventId: event.id ?? "unknown",
      paymentIntentId: event.data?.id ?? "unknown",
    });
  }

  return NextResponse.json({ ok: true, received: true });
}
