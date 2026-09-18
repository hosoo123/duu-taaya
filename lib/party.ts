export const PARTY_KINDS = ["party", "duel", "streak"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export const PARTY_MAX: Record<PartyKind, number> = {
  party: 8,
  duel: 2,
  streak: 6,
};

export type PartyPlayerInfo = {
  id: string;
  name: string;
  score: number;
  streak: number;
  roundsDone: number;
  ready: boolean;
  at: number;
};

export type PartyRoomInfo = {
  code: string;
  kind: PartyKind;
  mode: string;
  genre: string;
  difficulty: string;
  status: "lobby" | "playing" | "finished";
  trackIds: number[];
  hostKey: string;
  hostName: string;
  maxPlayers: number;
  sharedStreak: boolean;
  playerCount: number;
  createdAt: number;
  expiresAt: number;
  players: PartyPlayerInfo[];
};

export function cleanPartyName(raw: string) {
  return raw.replace(/[^\p{L}\p{N} _.-]/gu, "").trim().slice(0, 16);
}

export function makePartyCode(len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export function serializeParty(row: {
  code: string;
  kind: string;
  mode: string;
  genre?: string | null;
  difficulty: string;
  status: string;
  trackIds: number[];
  hostKey: string;
  hostName: string;
  maxPlayers: number;
  sharedStreak: boolean;
  createdAt: Date;
  expiresAt: Date;
  players: {
    id: string;
    name: string;
    score: number;
    streak: number;
    roundsDone: number;
    ready: boolean;
    updatedAt: Date;
  }[];
}): PartyRoomInfo {
  const players = [...row.players]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.roundsDone - a.roundsDone ||
        a.updatedAt.getTime() - b.updatedAt.getTime(),
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      streak: p.streak,
      roundsDone: p.roundsDone,
      ready: p.ready,
      at: p.updatedAt.getTime(),
    }));
  const kind = (PARTY_KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as PartyKind)
    : "party";
  const status =
    row.status === "playing" || row.status === "finished"
      ? row.status
      : "lobby";
  return {
    code: row.code,
    kind,
    mode: row.mode,
    genre: row.genre || "all",
    difficulty: row.difficulty,
    status,
    trackIds: row.trackIds,
    hostKey: row.hostKey,
    hostName: row.hostName,
    maxPlayers: row.maxPlayers,
    sharedStreak: row.sharedStreak,
    playerCount: players.length,
    createdAt: row.createdAt.getTime(),
    expiresAt: row.expiresAt.getTime(),
    players,
  };
}
