"use client";

import { useEffect, useState } from "react";
import type { Difficulty, Mode } from "@/data/catalog";
import type { PartyKind, PartyRoomInfo } from "@/lib/party";

export type GameModeId = "party" | "duel" | "streak" | "hotseat";

type Props = {
  open: boolean;
  onClose: () => void;
  playerName: string;
  mode: Mode;
  difficulty: Difficulty;
  room: PartyRoomInfo | null;
  isHost: boolean;
  busy: boolean;
  note: string;
  inviteCopied: boolean;
  onPickMode: (id: GameModeId) => void;
  onCreateParty: (kind: PartyKind) => void;
  onJoinParty: (code: string) => void;
  onStartParty: () => void;
  onCopyInvite: () => void;
  onRefresh: () => void;
  onLeave: () => void;
  hotSeatNames: string[];
  hotSeatTurn: number;
  onHotSeatSetup: (names: string[]) => void;
  onHotSeatExit: () => void;
};

const MODES: {
  id: GameModeId;
  title: string;
  blurb: string;
  tag: string;
}[] = [
  {
    id: "party",
    title: "Party Room",
    blurb: "Найзуудтайгаа ижил 10 дуу. Lobby → зэрэг тоглоод live оноо.",
    tag: "BEST",
  },
  {
    id: "duel",
    title: "1v1 Duel",
    blurb: "Хоёр хүн. Ижил дуунууд — хэн илүү оноо цуглуулах вэ.",
    tag: "VS",
  },
  {
    id: "streak",
    title: "Shared Streak",
    blurb: "Багийн streak. Нэг хүн буруу таавал бүгдийн streak унана.",
    tag: "TEAM",
  },
  {
    id: "hotseat",
    title: "Hot Seat",
    blurb: "Нэг утас. Ээлжлэн таа — phone-оо дараагийн хүнд өг.",
    tag: "LOCAL",
  },
];

export function GameModePanel({
  open,
  onClose,
  playerName,
  mode,
  difficulty,
  room,
  isHost,
  busy,
  note,
  inviteCopied,
  onPickMode,
  onCreateParty,
  onJoinParty,
  onStartParty,
  onCopyInvite,
  onRefresh,
  onLeave,
  hotSeatNames,
  hotSeatTurn,
  onHotSeatSetup,
  onHotSeatExit,
}: Props) {
  const [view, setView] = useState<"menu" | "join" | "hotseat-setup">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [seatDraft, setSeatDraft] = useState("Чи\nНайз");

  useEffect(() => {
    if (!open) setView("menu");
  }, [open]);

  if (!open) return null;

  const kindLabel =
    room?.kind === "duel"
      ? "1v1 Duel"
      : room?.kind === "streak"
        ? "Shared Streak"
        : "Party Room";

  return (
    <div
      className="board-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="board-card game-mode-card">
        <div className="board-head">
          <div>
            <small>GAME MODE</small>
            <strong>
              {room
                ? kindLabel
                : hotSeatNames.length > 0
                  ? "Hot Seat"
                  : "Multiplayer"}
            </strong>
          </div>
          <button
            type="button"
            className="board-close"
            onClick={onClose}
            aria-label="Хаах"
          >
            ×
          </button>
        </div>

        {room ? (
          <>
            <p className="board-meta">
              код <b>{room.code}</b> · {room.playerCount}/{room.maxPlayers} ·{" "}
              {room.status === "lobby"
                ? "lobby"
                : room.status === "finished"
                  ? "дууссан"
                  : "тоглож байна"}
              {room.sharedStreak ? " · shared streak" : ""}
            </p>
            <div className="board-list">
              {room.players.map((p, i) => (
                <div
                  key={p.id}
                  className={`board-row ${playerName && p.name.toLowerCase() === playerName.toLowerCase() ? "me" : ""}`}
                >
                  <span className="board-rank">{i + 1}</span>
                  <div className="board-main">
                    <span className="board-name">
                      {p.name}
                      {p.name.toLowerCase() === room.hostKey ? " · host" : ""}
                    </span>
                    <span className="board-diffs">
                      <span>{p.roundsDone}/10</span>
                      {p.streak > 0 && <span>streak {p.streak}</span>}
                    </span>
                  </div>
                  <span className="board-score">{p.score}</span>
                </div>
              ))}
            </div>
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions">
              <button
                type="button"
                className="ghost"
                onClick={onRefresh}
                disabled={busy}
              >
                Шинэчлэх
              </button>
              <button type="button" className="ghost" onClick={onCopyInvite}>
                {inviteCopied ? "Хуулсан!" : "Link хуулах"}
              </button>
              {isHost && room.status === "lobby" && (
                <button
                  type="button"
                  className="go"
                  onClick={onStartParty}
                  disabled={busy || room.playerCount < 1}
                >
                  Эхлэх
                </button>
              )}
              {room.status !== "lobby" && (
                <button type="button" className="go" onClick={onClose}>
                  Тоглох
                </button>
              )}
              <button type="button" className="ghost" onClick={onLeave}>
                Гарах
              </button>
            </div>
          </>
        ) : hotSeatNames.length > 0 ? (
          <>
            <p className="board-meta">
              Ээлж: <b>{hotSeatNames[hotSeatTurn % hotSeatNames.length]}</b>
            </p>
            <div className="board-list">
              {hotSeatNames.map((n, i) => (
                <div
                  key={`${n}-${i}`}
                  className={`board-row ${i === hotSeatTurn % hotSeatNames.length ? "me" : ""}`}
                >
                  <span className="board-rank">{i + 1}</span>
                  <span className="board-name">{n}</span>
                </div>
              ))}
            </div>
            <div className="board-actions">
              <button type="button" className="go" onClick={onClose}>
                Тоглох
              </button>
              <button type="button" className="ghost" onClick={onHotSeatExit}>
                Дуусгах
              </button>
            </div>
          </>
        ) : view === "join" ? (
          <>
            <p className="board-meta">Найзынхаа room код оруул</p>
            <input
              className="game-mode-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={8}
              autoCapitalize="characters"
            />
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setView("menu")}
              >
                Буцах
              </button>
              <button
                type="button"
                className="go"
                disabled={busy || joinCode.trim().length < 4}
                onClick={() => onJoinParty(joinCode.trim())}
              >
                Орох
              </button>
            </div>
          </>
        ) : view === "hotseat-setup" ? (
          <>
            <p className="board-meta">Нэрүүд — мөр бүрт нэг тоглогч</p>
            <textarea
              className="game-mode-input game-mode-area"
              value={seatDraft}
              onChange={(e) => setSeatDraft(e.target.value)}
              rows={4}
            />
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setView("menu")}
              >
                Буцах
              </button>
              <button
                type="button"
                className="go"
                onClick={() => {
                  const names = seatDraft
                    .split("\n")
                    .map((s) => s.trim())
                    .filter((s) => s.length >= 2)
                    .slice(0, 6);
                  if (names.length < 2) return;
                  onHotSeatSetup(names);
                }}
              >
                Эхлэх
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="board-meta">
              {mode === "foreign" ? "Гадаад" : "Монгол"} · {difficulty}
              {!playerName && " · эхлээд нэрээ оруул"}
            </p>
            <div className="game-mode-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="game-mode-tile"
                  disabled={busy || (!playerName && m.id !== "hotseat")}
                  onClick={() => {
                    onPickMode(m.id);
                    if (m.id === "hotseat") setView("hotseat-setup");
                    else if (m.id === "party" || m.id === "duel" || m.id === "streak")
                      onCreateParty(m.id);
                  }}
                >
                  <span className="game-mode-tag">{m.tag}</span>
                  <strong>{m.title}</strong>
                  <span>{m.blurb}</span>
                </button>
              ))}
            </div>
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => setView("join")}
                disabled={!playerName}
              >
                Кодоор орох
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
