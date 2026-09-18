import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { cleanPartyName, serializeParty } from "@/lib/party";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const hostKey = cleanPartyName(
    String(data?.hostKey || data?.name || ""),
  ).toLowerCase();
  const trackIds = Array.isArray(data?.trackIds)
    ? [
        ...new Set(
          data.trackIds
            .map((x) => Math.floor(Number(x)))
            .filter((n) => Number.isFinite(n) && n > 0),
        ),
      ].slice(0, 10)
    : [];
  const DIFFS = ["easy", "medium", "hard", "expert"] as const;
  const GENRES = [
    "all",
    "new",
    "hiphop",
    "pop",
    "rock",
    "traditional",
    "anime",
    "jpop",
    "nineties",
    "twoThousands",
  ] as const;
  const modeRaw = String(data?.mode || "").slice(0, 20);
  const mode =
    modeRaw === "foreign" || modeRaw === "mongolian" ? modeRaw : null;
  const difficultyRaw = String(data?.difficulty || "").slice(0, 20);
  const difficulty = (DIFFS as readonly string[]).includes(difficultyRaw)
    ? difficultyRaw
    : null;
  // ДАРАА
  const genreRaw = String(data?.genre || "").slice(0, 20);
  const mongolianOnlyExclusive = ["anime", "jpop", "nineties", "twoThousands"];
  const genre = !(GENRES as readonly string[]).includes(genreRaw)
    ? null
    : mode === "mongolian" && mongolianOnlyExclusive.includes(genreRaw)
      ? "all"
      : mode === "foreign" && genreRaw === "traditional"
        ? "all"
        : genreRaw;
  if (!code || !hostKey)
    return NextResponse.json({ error: "code" }, { status: 400 });
  if (trackIds.length !== 10)
    return NextResponse.json({ error: "trackIds" }, { status: 400 });

  try {
    const result = await db(async (client) => {
      const room = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      if (!room) return { error: "not found" as const };
      if (room.hostKey !== hostKey) return { error: "host" as const };
      if (room.status !== "lobby") return { error: "started" as const };
      if (room.players.length < 1) return { error: "players" as const };

      const updated = await client.partyRoom.update({
        where: { code },
        data: {
          status: "playing",
          trackIds,
          ...(mode ? { mode } : {}),
          ...(genre ? { genre } : {}),
          ...(difficulty ? { difficulty } : {}),
        },
        include: { players: true },
      });
      return { room: updated };
    });

    if ("error" in result) {
      const status =
        result.error === "not found"
          ? 404
          : result.error === "host"
            ? 403
            : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ room: serializeParty(result.room) });
  } catch (err) {
    console.error("party start", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
