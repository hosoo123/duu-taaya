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
  if (!code || code.length < 4)
    return NextResponse.json({ error: "code" }, { status: 400 });
  if (!name || name.length < 2)
    return NextResponse.json({ error: "name" }, { status: 400 });
  const nameKey = name.toLowerCase();

  try {
    const result = await db(async (client) => {
      const room = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      if (!room) return { error: "not found" as const };
      if (room.expiresAt.getTime() < Date.now())
        return { error: "expired" as const };

      // Refresh/reconnect: тоглолт эхэлсэн ч байсан тоглогч буцаж орно
      const existing = room.players.find((p) => p.nameKey === nameKey);
      if (existing) {
        const fresh = await client.partyRoom.findUnique({
          where: { code },
          include: { players: true },
        });
        return { room: fresh! };
      }
      if (room.status !== "lobby") return { error: "started" as const };
      if (room.players.length >= room.maxPlayers)
        return { error: "full" as const };

      await client.partyPlayer.create({
        data: {
          roomId: room.id,
          name,
          nameKey,
          ready: true,
        },
      });
      const fresh = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      return { room: fresh! };
    });

    if ("error" in result) {
      const status =
        result.error === "not found"
          ? 404
          : result.error === "expired"
            ? 410
            : result.error === "full"
              ? 409
              : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json({ room: serializeParty(result.room) });
  } catch (err) {
    console.error("party join", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
