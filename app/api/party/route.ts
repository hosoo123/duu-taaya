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
const MODES = ["mongolian", "foreign"] as const;

function parseMode(raw: unknown) {
  const s = String(raw || "mongolian").slice(0, 20);
  return (MODES as readonly string[]).includes(s) ? s : "mongolian";
}
function parseDifficulty(raw: unknown) {
  const s = String(raw || "medium").slice(0, 20);
  return (DIFFS as readonly string[]).includes(s) ? s : "medium";
}
function parseGenre(raw: unknown, mode: string) {
  const s = String(raw || "all").slice(0, 20);
  if (!(GENRES as readonly string[]).includes(s)) return "all";
  if (mode === "mongolian" && ["anime", "jpop", "nineties", "twoThousands"].includes(s))
    return "all";
  if (mode === "foreign" && s === "traditional") return "all";
  return s;
}

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
  const mode = parseMode(data?.mode);
  const difficulty = parseDifficulty(data?.difficulty);
  const genre = parseGenre(data?.genre, mode);
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
          genre,
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

/** Lobby: host mode / genre / difficulty шинэчлэх */
export async function PATCH(req: NextRequest) {
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
  if (!code || !hostKey)
    return NextResponse.json({ error: "input" }, { status: 400 });

  const mode = parseMode(data?.mode);
  const difficulty = parseDifficulty(data?.difficulty);
  const genre = parseGenre(data?.genre, mode);

  try {
    const result = await db(async (client) => {
      const room = await client.partyRoom.findUnique({
        where: { code },
        include: { players: true },
      });
      if (!room) return { error: "not found" as const };
      if (room.hostKey !== hostKey) return { error: "host" as const };
      if (room.status !== "lobby") return { error: "started" as const };

      const updated = await client.partyRoom.update({
        where: { code },
        data: { mode, genre, difficulty },
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
    console.error("party PATCH", err);
    return NextResponse.json({ error: "db" }, { status: 503 });
  }
}
