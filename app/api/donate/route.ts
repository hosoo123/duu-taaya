import { NextRequest, NextResponse } from "next/server";
import { Wire } from "@buildry-wire/wire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://duutaay.xyz";

const MIN_MNT = 1;
const MAX_MNT = 1_000_000;

function operatorsForKey(apiKey: string) {
  const fromEnv = (process.env.WIRE_ALLOWED_OPERATORS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (apiKey.startsWith("sk_test_")) return ["sandbox"];

  // This project currently has QPay enabled. Wire accepts only operators
  // connected to the project, so never forward stale or duplicate env values.
  if (fromEnv.includes("qpay")) return ["qpay"];
  return ["qpay"];
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.WIRE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Wire тохируулаагүй (WIRE_API_KEY)" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const amountMnt = Math.floor(Number(data?.amountMnt) || 0);
  if (amountMnt < MIN_MNT || amountMnt > MAX_MNT) {
    return NextResponse.json(
      { error: `Дүн ${MIN_MNT}–${MAX_MNT}₮ байх ёстой` },
      { status: 400 },
    );
  }

  const operators = operatorsForKey(apiKey);
  // Wire: 50000 minor = 500.00 MNT
  const amountMinor = amountMnt * 100;
  const wire = new Wire(apiKey);
  const donateId = crypto.randomUUID();

  try {
    const pi = await wire.paymentIntents.create({
      amount: amountMinor,
      currency: "MNT",
      allowed_operators: operators,
      metadata: {
        purpose: "donation",
        app: "duu-taaya",
        amount_mnt: String(amountMnt),
      },
      idempotencyKey: `donate-pi-${donateId}`,
    });

    const session = await wire.request<{
      id: string;
      url?: string;
      checkout_url?: string;
    }>("POST", "/v1/checkout/sessions", {
      body: {
        payment_intent: pi.id,
        success_url: `${SITE_URL}/?donated=1`,
        cancel_url: `${SITE_URL}/?donate=cancel`,
      },
      idempotencyKey: `donate-cs-${donateId}`,
    });

    const url = session.url || session.checkout_url;
    if (!url) {
      console.error("wire checkout missing url", session);
      return NextResponse.json(
        { error: "Checkout URL олдсонгүй" },
        { status: 502 },
      );
    }
    return NextResponse.json({ url, paymentIntentId: pi.id });
  } catch (err) {
    console.error("wire donate", err);
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: string }).message)
        : "Төлбөр үүсгэж чадсангүй";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
