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
  hint: string;
}[] = [
  {
    id: "party",
    title: "Party",
    blurb: "Олон хүн, ижил дуу, live оноо",
    hint: "8 хүртэл",
  },
  {
    id: "duel",
    title: "1v1",
    blurb: "Хоёр хүн — хэн түрүүлнэ",
    hint: "VS",
  },
  {
    id: "streak",
    title: "Streak",
    blurb: "Нэг streak-ээ хамт барина",
    hint: "Team",
  },
  {
    id: "hotseat",
    title: "Hot Seat",
    blurb: "Нэг утас, ээлжлэн таа",
    hint: "Local",
  },
];

const statusLabel = (s: PartyRoomInfo["status"]) =>
  s === "lobby" ? "Lobby" : s === "finished" ? "Дууссан" : "Тоглож байна";

const kindLabel = (kind: PartyRoomInfo["kind"]) =>
  kind === "duel" ? "1v1" : kind === "streak" ? "Streak" : "Party";

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
    if (!open) {
      setView("menu");
      setJoinCode("");
    }
  }, [open]);

  if (!open) return null;

  const title = room
    ? kindLabel(room.kind)
    : hotSeatNames.length > 0
      ? "Hot Seat"
      : view === "join"
        ? "Room-д орох"
        : view === "hotseat-setup"
          ? "Hot Seat"
          : "Хамт тоглох";

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
            <strong>{title}</strong>
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
            <div className="gm-code-row">
              <div className="gm-code">
                <span>код</span>
                <b>{room.code}</b>
              </div>
              <div className="gm-status">
                <i className={`gm-dot ${room.status}`} />
                {statusLabel(room.status)}
                <span>
                  {room.playerCount}/{room.maxPlayers}
                </span>
              </div>
            </div>
            <div className="board-list gm-list">
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
                      {p.streak > 0 && <span>×{p.streak}</span>}
                    </span>
                  </div>
                  <span className="board-score">{p.score}</span>
                </div>
              ))}
            </div>
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions gm-actions">
              <button
                type="button"
                className="ghost"
                onClick={onRefresh}
                disabled={busy}
              >
                Шинэчлэх
              </button>
              <button type="button" className="ghost" onClick={onCopyInvite}>
                {inviteCopied ? "Хуулсан" : "Link"}
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
              Одоо:{" "}
              <b className="gm-turn">
                {hotSeatNames[hotSeatTurn % hotSeatNames.length]}
              </b>
            </p>
            <div className="board-list gm-list">
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
            <div className="board-actions gm-actions">
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
            <p className="board-meta">Найзынхаа 6 оронтой кодыг бич</p>
            <input
              className="gm-input"
              value={joinCode}
              onChange={(e) =>
                setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="ABC123"
              maxLength={8}
              autoCapitalize="characters"
              autoFocus
            />
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions gm-actions">
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
            <p className="board-meta">Мөр бүрт нэг нэр (2–6 хүн)</p>
            <textarea
              className="gm-input gm-area"
              value={seatDraft}
              onChange={(e) => setSeatDraft(e.target.value)}
              rows={4}
              autoFocus
            />
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions gm-actions">
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
              {!playerName ? " · нэрээ оруул" : ""}
            </p>
            <div className="gm-grid">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`gm-tile${m.id === "party" ? " featured" : ""}`}
                  disabled={busy || (!playerName && m.id !== "hotseat")}
                  onClick={() => {
                    onPickMode(m.id);
                    if (m.id === "hotseat") setView("hotseat-setup");
                    else onCreateParty(m.id);
                  }}
                >
                  <span className="gm-tile-hint">{m.hint}</span>
                  <strong>{m.title}</strong>
                  <span className="gm-tile-blurb">{m.blurb}</span>
                </button>
              ))}
            </div>
            {note && <p className="board-note">{note}</p>}
            <div className="board-actions gm-actions">
              <button
                type="button"
                className="ghost gm-join-btn"
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
