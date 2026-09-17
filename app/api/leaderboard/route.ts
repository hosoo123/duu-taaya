import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX = 50;
const MAX_NAME = 16;
const MIN_SCORE = 1;
const DIFFS = ["easy", "medium", "hard", "expert"] as const;
type Diff = (typeof DIFFS)[number];

function cleanName(raw: string) {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, MAX_NAME);
}

function isDiff(v: string): v is Diff {
  return (DIFFS as readonly string[]).includes(v);
}

function fieldFor(d: Diff) {
  return (
    {
      easy: "easyScore",
      medium: "mediumScore",
      hard: "hardScore",
      expert: "expertScore",
    } as const
  )[d];
}

type ScoreRow = {
  id: string;
  name: string;
  score: number;
  streak: number;
  mode: string;
  difficulty: string;
  easyScore: number;
  mediumScore: number;
  hardScore: number;
  expertScore: number;
  updatedAt: Date;
};

function backfill(row: ScoreRow) {
  const sum =
    row.easyScore + row.mediumScore + row.hardScore + row.expertScore;
  if (sum > 0 || row.score <= 0 || !isDiff(row.difficulty)) return row;
  const next = { ...row };
  next[fieldFor(row.difficulty)] = row.score;
  return next;
}

function totalOf(row: Pick<ScoreRow, "easyScore" | "mediumScore" | "hardScore" | "expertScore">) {
  return row.easyScore + row.mediumScore + row.hardScore + row.expertScore;
}

function toEntry(raw: ScoreRow) {
  const row = backfill(raw);
  const score = Math.max(row.score, totalOf(row));
  return {
    id: row.id,
    name: row.name,
    score,
    streak: row.streak,
    mode: row.mode,
    difficulty: row.difficulty,
    easyScore: row.easyScore,
    mediumScore: row.mediumScore,
    hardScore: row.hardScore,
    expertScore: row.expertScore,
    at: row.updatedAt.getTime(),
  };
}

async function listScores() {
  const rows = await db((client) =>
    client.leaderboardScore.findMany({
      orderBy: [{ score: "desc" }, { streak: "desc" }, { updatedAt: "asc" }],
      take: MAX,
    }),
  );
  return rows.map((r) => toEntry(r as ScoreRow));
}

export async function GET() {
  try {
    const scores = await listScores();
    return NextResponse.json({ scores, persistent: true });
  } catch (err) {
    console.error("leaderboard GET", err);
    return NextResponse.json(
      { scores: [], persistent: false, error: "db" },
      { status: 503 },
    );
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
  const name = cleanName(String(data?.name || ""));
  const points = Math.floor(Number(data?.score));
  const streak = Math.max(0, Math.floor(Number(data?.streak) || 0));
  const mode = String(data?.mode || "mongolian").slice(0, 20);
  const difficultyRaw = String(data?.difficulty || "medium").slice(0, 20);
  const difficulty: Diff = isDiff(difficultyRaw) ? difficultyRaw : "medium";
  if (!name || name.length < 2)
    return NextResponse.json({ error: "name" }, { status: 400 });
  if (!Number.isFinite(points) || points < MIN_SCORE || points > 1_000_000) {
    return NextResponse.json({ error: "score" }, { status: 400 });
  }

  const nameKey = name.toLowerCase();
  const field = fieldFor(difficulty);
  try {
    const result = await db(async (client) => {
      const existing = (await client.leaderboardScore.findUnique({
        where: { nameKey },
      })) as ScoreRow | null;
      const base = existing
        ? backfill(existing)
        : {
            easyScore: 0,
            mediumScore: 0,
            hardScore: 0,
            expertScore: 0,
            streak: 0,
          };
      const prevDiff = base[field];
      if (points <= prevDiff) {
        return { updated: false as const };
      }
      const nextScores = {
        easyScore: base.easyScore,
        mediumScore: base.mediumScore,
        hardScore: base.hardScore,
        expertScore: base.expertScore,
        [field]: points,
      };
      const score = totalOf(nextScores);
      await client.leaderboardScore.upsert({
        where: { nameKey },
        create: {
          name,
          nameKey,
          score,
          streak,
          mode,
          difficulty,
          ...nextScores,
        },
        update: {
          name,
          score,
          streak: Math.max(streak, existing?.streak || 0),
          mode,
          difficulty,
          ...nextScores,
        },
      });
      return { updated: true as const };
    });
    const scores = await listScores();
    return NextResponse.json({
      scores,
      updated: result.updated,
      persistent: true,
    });
  } catch (err) {
    console.error("leaderboard POST", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
