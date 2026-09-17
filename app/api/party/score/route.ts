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
  const name = cleanPartyName(String(data?.name || ""));
  const score = Math.max(0, Math.floor(Number(data?.score) || 0));
  const streak = Math.max(0, Math.floor(Number(data?.streak) || 0));
  const roundsDone = Math.max(
    0,
    Math.min(10, Math.floor(Number(data?.roundsDone) || 0)),
  );
  if (!code || !name || name.length < 2)
    return NextResponse.json({ error: "input" }, { status: 400 });
  const nameKey = name.toLowerCase();

  try {
    const result = await db(async (client) => {
      const room = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      if (!room) return { error: "not found" as const };
      if (room.status === "lobby") return { error: "lobby" as const };

      const player = room.players.find((p) => p.nameKey === nameKey);
      if (!player) return { error: "player" as const };

      await client.partyPlayer.update({
        where: { id: player.id },
        data: {
          score: Math.max(player.score, score),
          streak: Math.max(player.streak, streak),
          roundsDone: Math.max(player.roundsDone, roundsDone),
        },
      });

      const fresh = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      if (!fresh) return { error: "not found" as const };

      const allDone =
        fresh.players.length > 0 &&
        fresh.players.every((p) => p.roundsDone >= 10);
      if (allDone && fresh.status !== "finished") {
        const done = await client.partyRoom.update({
          where: { code },
          data: { status: "finished" },
          include: { players: true },
        });
        return { room: done };
      }
      return { room: fresh };
    });

    if ("error" in result) {
      const status = result.error === "not found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ room: serializeParty(result.room) });
  } catch (err) {
    console.error("party score", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
