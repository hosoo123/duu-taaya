import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import {
  PARTY_KINDS,
  PARTY_MAX,
  cleanPartyName,
  makePartyCode,
  serializeParty,
  type PartyKind,
} from "@/lib/party";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TTL_MS = 6 * 60 * 60 * 1000;
const DIFFS = ["easy", "medium", "hard", "expert"] as const;

export async function GET(req: NextRequest) {
  const code = String(req.nextUrl.searchParams.get("code") || "")
    .trim()
    .toUpperCase();
  if (!code || code.length < 4)
    return NextResponse.json({ error: "code" }, { status: 400 });
  try {
    const row = await db((client) =>
      client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      }),
    );
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (row.expiresAt.getTime() < Date.now())
      return NextResponse.json({ error: "expired" }, { status: 410 });
    return NextResponse.json({ room: serializeParty(row) });
  } catch (err) {
    console.error("party GET", err);
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
  const hostName = cleanPartyName(String(data?.hostName || data?.name || ""));
  const kindRaw = String(data?.kind || "party");
  const kind: PartyKind = (PARTY_KINDS as readonly string[]).includes(kindRaw)
    ? (kindRaw as PartyKind)
    : "party";
  const mode = String(data?.mode || "mongolian").slice(0, 20);
  const difficultyRaw = String(data?.difficulty || "medium").slice(0, 20);
  const difficulty = (DIFFS as readonly string[]).includes(difficultyRaw)
    ? difficultyRaw
    : "medium";
  if (!hostName || hostName.length < 2)
    return NextResponse.json({ error: "name" }, { status: 400 });

  const hostKey = hostName.toLowerCase();
  const maxPlayers = PARTY_MAX[kind];
  const sharedStreak = kind === "streak";

  try {
    const room = await db(async (client) => {
      let code = makePartyCode();
      for (let i = 0; i < 8; i++) {
        const clash = await client.partyRoom.findUnique({ where: { code } });
        if (!clash) break;
        code = makePartyCode();
      }
      return client.partyRoom.create({
        data: {
          code,
          kind,
          mode,
          difficulty,
          status: "lobby",
          hostKey,
          hostName,
          maxPlayers,
          sharedStreak,
          expiresAt: new Date(Date.now() + TTL_MS),
          players: {
            create: {
              name: hostName,
              nameKey: hostKey,
              ready: true,
            },
          },
        },
        include: { players: true },
      });
    });
    return NextResponse.json({ room: serializeParty(room) });
  } catch (err) {
    console.error("party POST", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
