import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 16;
const MAX_PLAYERS = 5;
const MIN_SCORE = 1;

function cleanName(raw: string) {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, MAX_NAME);
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

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const code = String(data?.code || "")
    .trim()
    .toUpperCase();
  const name = cleanName(String(data?.name || ""));
  const score = Math.floor(Number(data?.score));
  const streak = Math.max(0, Math.floor(Number(data?.streak) || 0));
  if (!code || code.length < 4)
    return NextResponse.json({ error: "code" }, { status: 400 });
  if (!name || name.length < 2)
    return NextResponse.json({ error: "name" }, { status: 400 });
  if (!Number.isFinite(score) || score < MIN_SCORE || score > 1_000_000)
    return NextResponse.json({ error: "score" }, { status: 400 });

  const nameKey = name.toLowerCase();
  try {
    const result = await db(async (client) => {
      const challenge = await client.challenge.findUnique({
        where: { code },
        include: { results: true },
      });
      if (!challenge) return { error: "not found" as const };
      if (challenge.expiresAt.getTime() < Date.now())
        return { error: "expired" as const };

      const existing = challenge.results.find((r) => r.nameKey === nameKey);
      if (!existing && challenge.results.length >= MAX_PLAYERS)
        return { error: "full" as const };
      if (existing && score <= existing.score)
        return {
          updated: false as const,
          challenge,
        };

      if (existing) {
        await client.challengeResult.update({
          where: { id: existing.id },
          data: {
            name,
            score,
            streak: Math.max(streak, existing.streak),
          },
        });
      } else {
        await client.challengeResult.create({
          data: {
            challengeId: challenge.id,
            name,
            nameKey,
            score,
            streak,
          },
        });
      }

      const fresh = await client.challenge.findUnique({
        where: { code },
        include: { results: true },
      });
      return { updated: true as const, challenge: fresh! };
    });

    if ("error" in result) {
      const status =
        result.error === "not found"
          ? 404
          : result.error === "expired"
            ? 410
            : result.error === "full"
              ? 403
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      challenge: serialize(result.challenge),
      updated: result.updated,
      persistent: true,
    });
  } catch (err) {
    console.error("challenge result POST", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
