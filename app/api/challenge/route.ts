import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 16;
const MAX_PLAYERS = 5;
const CODE_LEN = 8;
const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DIFFS = ["easy", "medium", "hard", "expert"] as const;

function cleanName(raw: string) {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, MAX_NAME);
}

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

function serialize(
  row: {
    code: string;
    mode: string;
    difficulty: string;
    trackIds: number[];
    hostName: string;
    createdAt: Date;
    expiresAt: Date;
    results: {
      id: string;
      name: string;
      score: number;
      streak: number;
      updatedAt: Date;
    }[];
  },
) {
  const results = [...row.results]
    .sort((a, b) => b.score - a.score || a.updatedAt.getTime() - b.updatedAt.getTime())
    .map((r) => ({
      id: r.id,
      name: r.name,
      score: r.score,
      streak: r.streak,
      at: r.updatedAt.getTime(),
    }));
  return {
    code: row.code,
    mode: row.mode,
    difficulty: row.difficulty,
    trackIds: row.trackIds,
    hostName: row.hostName,
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
    playerCount: results.length,
    maxPlayers: MAX_PLAYERS,
    full: results.length >= MAX_PLAYERS,
    results,
  };
}

export async function GET(req: NextRequest) {
  const code = String(req.nextUrl.searchParams.get("code") || "")
    .trim()
    .toUpperCase();
  if (!code || code.length < 4)
    return NextResponse.json({ error: "code" }, { status: 400 });
  try {
    const row = await db((client) =>
      client.challenge.findUnique({
        where: { code },
        include: { results: true },
      }),
    );
    if (!row)
      return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.expiresAt.getTime() < Date.now())
      return NextResponse.json({ error: "expired" }, { status: 410 });
    return NextResponse.json({ challenge: serialize(row), persistent: true });
  } catch (err) {
    console.error("challenge GET", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const hostName = cleanName(String(data?.hostName || data?.name || ""));
  const mode = String(data?.mode || "mongolian").slice(0, 20);
  const difficultyRaw = String(data?.difficulty || "medium").slice(0, 20);
  const difficulty = (DIFFS as readonly string[]).includes(difficultyRaw)
    ? difficultyRaw
    : "medium";
  const trackIds = Array.isArray(data?.trackIds)
    ? data.trackIds.map((x) => Math.floor(Number(x))).filter((n) => Number.isFinite(n) && n > 0)
    : [];
  const score = Math.floor(Number(data?.score) || 0);
  const streak = Math.max(0, Math.floor(Number(data?.streak) || 0));
  if (!hostName || hostName.length < 2)
    return NextResponse.json({ error: "name" }, { status: 400 });
  if (trackIds.length !== 10)
    return NextResponse.json({ error: "trackIds" }, { status: 400 });

  try {
    const challenge = await db(async (client) => {
      let code = makeCode();
      for (let i = 0; i < 6; i++) {
        const clash = await client.challenge.findUnique({ where: { code } });
        if (!clash) break;
        code = makeCode();
      }
      const created = await client.challenge.create({
        data: {
          code,
          mode,
          difficulty,
          trackIds,
          hostName,
          expiresAt: new Date(Date.now() + TTL_MS),
          results:
            score > 0
              ? {
                  create: {
                    name: hostName,
                    nameKey: hostName.toLowerCase(),
                    score,
                    streak,
                  },
                }
              : undefined,
        },
        include: { results: true },
      });
      return created;
    });
    return NextResponse.json({
      challenge: serialize(challenge),
      persistent: true,
    });
  } catch (err) {
    console.error("challenge POST", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
