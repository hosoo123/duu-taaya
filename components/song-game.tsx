"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignInButton, Show, UserButton } from "@clerk/nextjs";
import {
  animeRomajiByCanon,
  animeRomajiDisplay,
  animeSources,
  animeSourcesByTitle,
  cuePoints,
  difficultyLimits,
  foreignFeatured,
  foreignPools,
  mongolianFeatured,
  mongolianPools,
  type Difficulty,
  type Genre,
  type Mode,
} from "@/data/catalog";
import { clerkEnabled } from "@/components/app-clerk-provider";
import ClerkIdentityBridge from "@/components/clerk-identity-bridge";
import { GameModePanel, type GameModeId } from "@/components/game-mode-panel";
import { DonatePanel } from "@/components/donate-panel";
import type { PartyKind, PartyRoomInfo } from "@/lib/party";
type Track = {
  trackId: number;
  artistId: number;
  trackName: string;
  artistName: string;
  previewUrl: string;
  artworkUrl100?: string;
  releaseDate?: string;
  collectionName?: string;
  wrapperType: string;
};
const genres: Genre[] = [
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
];
const instrumental =
  /\b(instrumental|karaoke|backing track|minus one|no vocals?|vocal off|off vocal|beat only)\b|зөвхөн ая|ая хувилбар/i;
const edition =
  /\b(remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit)\b/i;
const featMark =
  /\b(ft\.?|feat\.?|featuring)\b/i;
const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zа-яөүё0-9]/gi, "");
const canonicalTitle = (s: string) =>
  norm(
    (s || "")
      .replace(
        /\s*[\[(][^\])]*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size|from\s*[^\])]+)[^\])]*[\])]/gi,
        "",
      )
      .replace(
        /\s*[-–—]\s*(?:remaster(?:ed)?|live|remix|acoustic|instrumental|karaoke|radio edit|sped up|slowed|version|edit|tv\s*size).*$/i,
        "",
      )
      .replace(
        /\s*[\[(][^)\]]*(?:ft\.?|feat\.?|featuring|from\s+)[^)\]]*[\])]/gi,
        "",
      )
      .replace(
        /\s*(?:ft\.?|feat\.?|featuring)\s+.+$/i,
        "",
      )
      .trim(),
  );
const titleCleaner = (t: Track) => {
  const feat = featMark.test(t.trackName) ? 1 : 0;
  const ed = edition.test(t.trackName) ? 1 : 0;
  return feat * 2 + ed + t.trackName.length / 1000;
};
const distance = (a: string, b: string) => {
  const m = a.length,
    n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] =
        a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
};
const sameSong = (a: Track, b: Track) =>
  canonicalTitle(a.trackName) === canonicalTitle(b.trackName) &&
  norm(a.artistName) === norm(b.artistName);
const titleHits = (guess: string, title: string) => {
  const q = canonicalTitle(guess),
    t = canonicalTitle(title);
  if (!q || !t) return false;
  if (q === t) return true;
  const need = Math.max(5, Math.ceil(t.length * 0.85));
  if (q.length < need) return false;
  const maxDist =
    t.length <= 5 ? 0 : t.length <= 10 ? 1 : t.length <= 18 ? 2 : 3;
  return distance(q, t) <= maxDist;
};
const romajiHits = (guess: string, track: Track) => {
  const key = canonicalTitle(track.trackName);
  const alts = animeRomajiByCanon[key] || [];
  return alts.some((alt) => titleHits(guess, alt));
};
const guessCorrect = (
  guess: string,
  track: Track,
  picked: Track | null,
  selectedId: number | null,
) =>
  selectedId === track.trackId ||
  (!!picked && sameSong(picked, track)) ||
  titleHits(guess, track.trackName) ||
  romajiHits(guess, track);
const animeOf = (t: Track) => {
  if (animeSources[t.trackId]) return animeSources[t.trackId];
  const c = canonicalTitle(t.trackName);
  if (animeSourcesByTitle[c]) return animeSourcesByTitle[c];
  const hit = Object.entries(animeSourcesByTitle).find(
    ([k]) => c.length >= 4 && (c.includes(k) || k.includes(c)),
  );
  return hit ? hit[1] : null;
};
const romajiOf = (t: Track) => {
  const c = canonicalTitle(t.trackName);
  if (animeRomajiDisplay[c]) return animeRomajiDisplay[c];
  const hit = Object.entries(animeRomajiDisplay).find(
    ([k]) => c.length >= 4 && (c.includes(k) || k.includes(c)),
  );
  return hit ? hit[1] : null;
};
const listenLabel = (t: Track) => {
  const r = romajiOf(t);
  return { title: (r || t.trackName).trim(), artist: t.artistName.trim() };
};
const listenQuery = (t: Track) => {
  const { title, artist } = listenLabel(t),
    a = animeOf(t);
  return encodeURIComponent(
    [title, artist, a ? `anime ${a}` : ""].filter(Boolean).join(" "),
  );
};
const spotifySearchUrl = (t: Track) =>
  `https://open.spotify.com/search/${listenQuery(t)}`;
const youtubeSearchUrl = (t: Track) =>
  `https://www.youtube.com/results?search_query=${listenQuery(t)}`;
type SkippedInfo = {
  trackName: string;
  artistName: string;
  romaji: string | null;
  anime: string | null;
  spotify: string;
  youtube: string;
};
const resolveListenLinks = async (t: Track) => {
  const fallback = {
    spotify: spotifySearchUrl(t),
    youtube: youtubeSearchUrl(t),
  };
  try {
    const { title, artist } = listenLabel(t);
    const res = await fetch(
      `/api/listen-links?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
    );
    if (!res.ok) return fallback;
    const data = await res.json();
    return {
      spotify:
        typeof data.spotify === "string" && data.spotify
          ? data.spotify
          : fallback.spotify,
      youtube:
        typeof data.youtube === "string" && data.youtube
          ? data.youtube
          : fallback.youtube,
    };
  } catch {
    return fallback;
  }
};
const animeAliases: Record<string, string[]> = {
  demonslayerkimetsunoyaiba: ["demonslayer", "kimetsu", "kny"],
  demonslayermugentrain: ["demonslayer", "mugentrain", "kimetsu"],
  tokyoghoul: ["tokyoghoul", "ghoul"],
  swordartonline: ["sao", "swordart"],
  neongenesisevangelion: ["evangelion", "eva", "nge"],
  narutoshippuden: ["naruto", "shippuden"],
  naruto: ["naruto"],
  attackontitan: ["aot", "snk", "shingeki", "titan"],
  attackontitanthefinalseason: ["aot", "snk", "finalseason", "titan"],
  attackontitanseason2: ["aot", "snk", "titan"],
  attackontitanseason3: ["aot", "snk", "titan"],
  jujutsukaisen: ["jjk", "jujutsu"],
  jujutsukaisenseason2: ["jjk", "jujutsu"],
  oshinoko: ["oshinoko", "onk"],
  chainsawman: ["chainsaw", "csm"],
  mashlemagicandmuscles: ["mashle"],
  dandadan: ["dandadan", "ddd"],
  myheroacademia: ["mha", "boku", "heroacademia"],
  myheroacademiaseason3: ["mha", "boku", "heroacademia"],
  fireforce: ["fireforce"],
  onepiece: ["onepiece", "op"],
  onepiecefilmred: ["onepiece", "filmred"],
  fullmetalalchemistbrotherhood: ["fma", "fmab", "fullmetal"],
  cowboybebop: ["bebop", "cowboy"],
  bluelock: ["bluelock"],
  codegeass: ["codegeass", "geass"],
  haikyuu: ["haikyuu", "haikyu"],
  yourname: ["yourname", "kiminonawa"],
  cyberpunkedgerunners: ["cyberpunk", "edgerunners"],
  initiald: ["initiald", "initial d", "eurobeat"],
  samuraichamploo: ["champloo", "samurai"],
  parasytethemaxim: ["parasyte"],
  ghostintheshellstandalonecomplex: ["ghostintheshell", "gits"],
  cityhunter: ["cityhunter"],
  onepunchman: ["onepunchman", "opm"],
  onepunchmanseason2: ["onepunchman", "opm", "opms2"],
  onepunchmanseason3: ["onepunchman", "opm", "opms3"],
  steinsgate: ["steinsgate", "steins gate"],
  frierenbeyondjourneysend: ["frieren", "sousounofrieren"],
  sololeveling: ["sololeveling", "solo leveling"],
  bocchitherock: ["bocchi", "bocchitherock"],
  deliciousindungeon: ["deliciousindungeon", "dungeonmeshi"],
  demonslayerhashiratrainingarc: ["demonslayer", "hashira", "kimetsu"],
  kaijuno8: ["kaiju", "kaijuno8"],
  tokyorevengers: ["tokyorevengers", "tr"],
  windbreaker: ["windbreaker"],
  spyxfamily: ["spyxfamily", "sxf", "spyfamily"],
  demonslayerentertainmentdistrictarc: ["demonslayer", "kimetsu"],
  demonslayermugentrainarc: ["demonslayer", "mugentrain", "kimetsu"],
  hunterhunter2011: ["hunterxhunter", "hxh", "hunterx", "hunter hunter"],
  deathnote: ["deathnote", "death note"],
  darlinginthefranxx: ["darlinginthefranxx", "ditf", "franxx"],
  chainsawmanthemovierezearc: ["chainsaw", "csm", "reze", "chainsawman"],
  overlord: ["overlord"],
  overlordii: ["overlord", "overlord2"],
  overlordiii: ["overlord", "overlord3"],
  overlordiv: ["overlord", "overlord4"],
  bleach: ["bleach"],
  bleachthousandyearbloodwar: [
    "bleach",
    "tybw",
    "thousandyearbloodwar",
    "bleach tybw",
  ],
  nogamenolife: ["nogamenolife", "ngnl", "no game no life"],
  nogamenolifezero: ["nogamenolife", "ngnl", "ngnlzero", "no game no life"],
  thattimeigotreincarnatedasaslime: [
    "tensura",
    "slime",
    "tenseishitaraslime",
    "reincarnatedasaslime",
  ],
  thattimeigotreincarnatedasaslimeseason2: [
    "tensura",
    "slime",
    "tenseishitaraslime",
    "reincarnatedasaslime",
  ],
  thattimeigotreincarnatedasaslimescarletbond: [
    "tensura",
    "slime",
    "scarletbond",
    "tenseishitaraslime",
  ],
};
const animeHit = (t: Track, q: string) => {
  const a = animeOf(t);
  if (!a || q.length < 2) return false;
  const na = norm(a);
  if (na.includes(q)) return true;
  const aliases = animeAliases[na] || [];
  return aliases.some((x) => x.includes(q) || q.includes(x));
};
const shuffle = <T,>(x: T[]) => {
  const a = [...x];
  for (let i = a.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    const j = n[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const seededShuffle = <T,>(x: T[], seed: string) => {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++)
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const a = [...x];
  for (let i = a.length - 1; i > 0; i--) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const visibleGenres = (mode: Mode) =>
  genres.filter((g) =>
    mode === "mongolian"
      ? g !== "anime" &&
        g !== "jpop" &&
        g !== "nineties" &&
        g !== "twoThousands"
      : g !== "traditional",
  );
const diffLabel: Record<Difficulty, string> = {
  easy: "Easy",
  medium: "Med",
  hard: "Hard",
  expert: "Pro",
};
const genreLabel = (g: Genre) =>
  g === "all"
    ? "Бүгд"
    : g === "new"
      ? "Шинэ"
      : g === "traditional"
        ? "Зохиол"
        : g === "anime"
          ? "Anime OP"
          : g === "jpop"
            ? "J-pop"
            : g === "nineties"
              ? "90s"
              : g === "twoThousands"
                ? "2000s"
                : g === "hiphop"
                  ? "Hip-Hop"
                  : g === "pop"
                    ? "Pop"
                    : "Rock";
const releaseYear = (t: Track) => {
  const d = t.releaseDate;
  if (!d) return null;
  const y = new Date(d).getFullYear();
  return Number.isFinite(y) ? y : null;
};
const eraOnly = new Set<Genre>(["nineties", "twoThousands"]);
type BoardEntry = {
  id: string;
  name: string;
  score: number;
  streak: number;
  mode: string;
  difficulty: string;
  easyScore?: number;
  mediumScore?: number;
  hardScore?: number;
  expertScore?: number;
  at: number;
};
type CommentEntry = { id: string; name: string; body: string; at: number };
const LOCAL_BOARD_KEY = "duuTaayaBoard";
const NAME_KEY = "duuTaayaName";
const GUEST_KEY = "duuTaayaGuest";
const cleanName = (raw: string) =>
  raw
    .replace(/[^\p{L}\p{N} _.-]/gu, "")
    .trim()
    .slice(0, 16);
const pickSetIds = (pool: Track[], mode: Mode) => {
  const fromPool = [
    ...new Set(
      pool.filter((t) => t.previewUrl).map((t) => t.trackId),
    ),
  ];
  if (fromPool.length >= 10) return shuffle(fromPool).slice(0, 10);
  const featured =
    mode === "mongolian" ? mongolianFeatured : foreignFeatured;
  const ids = [...new Set(Object.values(featured).flat())];
  return shuffle([...fromPool, ...ids.filter((id) => !fromPool.includes(id))]).slice(
    0,
    10,
  );
};
const diffScores = (e: BoardEntry) => ({
  easyScore: e.easyScore ?? (e.difficulty === "easy" ? e.score : 0),
  mediumScore: e.mediumScore ?? (e.difficulty === "medium" ? e.score : 0),
  hardScore: e.hardScore ?? (e.difficulty === "hard" ? e.score : 0),
  expertScore: e.expertScore ?? (e.difficulty === "expert" ? e.score : 0),
});
const totalScore = (e: BoardEntry) => {
  const d = diffScores(e);
  const sum = d.easyScore + d.mediumScore + d.hardScore + d.expertScore;
  return Math.max(e.score || 0, sum);
};
const readLocalBoard = (): BoardEntry[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_BOARD_KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};
const writeLocalBoard = (list: BoardEntry[]) => {
  try {
    localStorage.setItem(LOCAL_BOARD_KEY, JSON.stringify(list.slice(0, 50)));
  } catch {}
};
const mergeBoards = (a: BoardEntry[], b: BoardEntry[]) => {
  const map = new Map<string, BoardEntry>();
  for (const e of [...a, ...b]) {
    const k = e.name.toLowerCase();
    const prev = map.get(k);
    const nextDiff = diffScores(e);
    if (!prev) {
      map.set(k, {
        ...e,
        ...nextDiff,
        score: totalScore({ ...e, ...nextDiff }),
      });
      continue;
    }
    const prevDiff = diffScores(prev);
    const merged = {
      easyScore: Math.max(prevDiff.easyScore, nextDiff.easyScore),
      mediumScore: Math.max(prevDiff.mediumScore, nextDiff.mediumScore),
      hardScore: Math.max(prevDiff.hardScore, nextDiff.hardScore),
      expertScore: Math.max(prevDiff.expertScore, nextDiff.expertScore),
    };
    const newer = e.at >= prev.at ? e : prev;
    map.set(k, {
      ...newer,
      ...merged,
      streak: Math.max(prev.streak, e.streak),
      score: merged.easyScore + merged.mediumScore + merged.hardScore + merged.expertScore,
    });
  }
  return [...map.values()]
    .sort((x, y) => y.score - x.score || y.streak - x.streak || x.at - y.at)
    .slice(0, 50);
};
const timeAgo = (at: number) => {
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return "саяхан";
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ц`;
  return `${Math.floor(s / 86400)}ө`;
};
export default function SongGame() {
  const [mode, setMode] = useState<Mode>("mongolian"),
    [genre, setGenre] = useState<Genre>("all"),
    [difficulty, setDifficulty] = useState<Difficulty>("medium"),
    [tracks, setTracks] = useState<Track[]>([]),
    [current, setCurrent] = useState<Track | null>(null),
    [level, setLevel] = useState(0),
    [score, setScore] = useState(0),
    [streak, setStreak] = useState(0),
    [round, setRound] = useState(1),
    [loading, setLoading] = useState(true),
    [playing, setPlaying] = useState(false),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState<"" | "good" | "bad">(""),
    [guess, setGuess] = useState(""),
    [selected, setSelected] = useState<number | null>(null),
    [revealed, setRevealed] = useState(false),
    [revealInfo, setRevealInfo] = useState<
      (SkippedInfo & { artwork?: string; ok: boolean }) | null
    >(null),
    [lastSkipped, setLastSkipped] = useState<SkippedInfo | null>(null),
    [volume, setVolume] = useState(0.75),
    [sfxVolume, setSfxVolume] = useState(0.7),
    [volPulse, setVolPulse] = useState(false),
    [sfxPulse, setSfxPulse] = useState(false),
    [suggestionsOpen, setSuggestionsOpen] = useState(false),
    [shaking, setShaking] = useState(false),
    [fireworks, setFireworks] = useState<
      { id: number; x: number; y: number; hue: number; delay: number }[]
    >([]),
    [playerName, setPlayerName] = useState(""),
    [nameDraft, setNameDraft] = useState(""),
    [boardOpen, setBoardOpen] = useState(false),
    [nameOpen, setNameOpen] = useState(false),
    [board, setBoard] = useState<BoardEntry[]>([]),
    [boardBusy, setBoardBusy] = useState(false),
    [submitNote, setSubmitNote] = useState(""),
    [settingsOpen, setSettingsOpen] = useState(false),
    [commentsOpen, setCommentsOpen] = useState(false),
    [donateOpen, setDonateOpen] = useState(false),
    [donateBanner, setDonateBanner] = useState<null | "success" | "cancelled">(
      null,
    ),
    [comments, setComments] = useState<CommentEntry[]>([]),
    [commentDraft, setCommentDraft] = useState(""),
    [commentsBusy, setCommentsBusy] = useState(false),
    [commentNote, setCommentNote] = useState(""),
    [bootReady, setBootReady] = useState(false),
    [party, setParty] = useState<PartyRoomInfo | null>(null),
    [lockedTrackIds, setLockedTrackIds] = useState<number[] | null>(null),
    [gameModeOpen, setGameModeOpen] = useState(false),
    [partyBusy, setPartyBusy] = useState(false),
    [partyNote, setPartyNote] = useState(""),
    [inviteCopied, setInviteCopied] = useState(false),
    [hotSeatNames, setHotSeatNames] = useState<string[]>([]),
    [hotSeatTurn, setHotSeatTurn] = useState(0),
    [hotSeatScores, setHotSeatScores] = useState<Record<string, number>>({}),
    [clerkSignedIn, setClerkSignedIn] = useState(false);
  const audio = useRef<HTMLAudioElement>(null),
    wave = useRef<HTMLDivElement>(null),
    searchbox = useRef<HTMLDivElement>(null),
    fabDock = useRef<HTMLDivElement>(null),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    animation = useRef<number | null>(null),
    audioContext = useRef<AudioContext | null>(null),
    sfxContext = useRef<AudioContext | null>(null),
    analyser = useRef<AnalyserNode | null>(null),
    mediaSource = useRef<MediaElementAudioSourceNode | null>(null),
    remaining = useRef(0),
    started = useRef(0),
    paused = useRef(false),
    sfxVolRef = useRef(0.7),
    scoreRef = useRef(0),
    streakRef = useRef(0),
    nameRef = useRef(""),
    setPlayedRef = useRef<number[]>([]),
    lastSetIdsRef = useRef<number[]>([]),
    lastSetScoreRef = useRef(0),
    lastSetStreakRef = useRef(0),
    partyCodeRef = useRef<string | null>(null),
    partyAppliedRef = useRef(false),
    partyJoinAttemptRef = useRef<string | null>(null),
    partyResumeRef = useRef(0),
    limits = difficultyLimits[difficulty];
  const isPartyHost =
    !!party &&
    !!playerName &&
    playerName.toLowerCase() === party.hostKey;
  const partyAuthed = clerkEnabled
    ? clerkSignedIn
    : playerName.trim().length >= 2;
  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    streakRef.current = streak;
  }, [streak]);
  useEffect(() => {
    nameRef.current = playerName;
  }, [playerName]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("duuTaayaSfxVol");
      if (saved != null) {
        const v = Math.min(1, Math.max(0, Number(saved)));
        setSfxVolume(v);
        sfxVolRef.current = v;
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      const n = cleanName(localStorage.getItem(NAME_KEY) || "");
      const guest = localStorage.getItem(GUEST_KEY) === "1";
      if (n) {
        setPlayerName(n);
        setNameDraft(n);
      } else if (guest) {
        setPlayerName("Зочин");
        setNameDraft("Зочин");
        nameRef.current = "Зочин";
      } else setNameOpen(true);
      setBoard(readLocalBoard());
    } catch {
      setNameOpen(true);
    }
  }, []);
  const onClerkIdentity = useCallback(
    (info: {
      signedIn: boolean;
      name: string | null;
      loaded: boolean;
    }) => {
      setClerkSignedIn(info.signedIn);
      if (!info.loaded) return;
      if (info.signedIn && info.name) {
        setPlayerName(info.name);
        setNameDraft(info.name);
        nameRef.current = info.name;
        try {
          localStorage.setItem(NAME_KEY, info.name);
          localStorage.removeItem(GUEST_KEY);
        } catch {}
        setNameOpen(false);
      }
    },
    [],
  );
  useEffect(() => {
    sfxVolRef.current = sfxVolume;
    try {
      localStorage.setItem("duuTaayaSfxVol", String(sfxVolume));
    } catch {}
  }, [sfxVolume]);
  const saveName = (raw: string) => {
    const n = cleanName(raw);
    if (n.length < 2) return false;
    setPlayerName(n);
    setNameDraft(n);
    nameRef.current = n;
    try {
      localStorage.setItem(NAME_KEY, n);
      localStorage.setItem(GUEST_KEY, "1");
    } catch {}
    setNameOpen(false);
    return true;
  };
  const continueAsGuest = (raw?: string) => {
    const n = cleanName(raw || nameDraft) || "Зочин";
    setPlayerName(n);
    setNameDraft(n);
    nameRef.current = n;
    try {
      localStorage.setItem(NAME_KEY, n);
      localStorage.setItem(GUEST_KEY, "1");
    } catch {}
    setNameOpen(false);
  };
  const refreshBoard = useCallback(async () => {
    setBoardBusy(true);
    try {
      const local = readLocalBoard();
      const res = await fetch("/api/leaderboard", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const remote = Array.isArray(data.scores)
          ? (data.scores as BoardEntry[])
          : [];
        const merged = mergeBoards(local, remote);
        writeLocalBoard(merged);
        setBoard(merged);
      } else setBoard(local);
    } catch {
      setBoard(readLocalBoard());
    } finally {
      setBoardBusy(false);
    }
  }, []);
  const submitScore = useCallback(
    async (force = false) => {
      const name = nameRef.current || playerName;
      const points = scoreRef.current;
      const st = streakRef.current;
      if (!name || points < 1) {
        if (force) {
          setNameOpen(true);
          setSubmitNote("Эхлээд нэрээ оруул");
        }
        return;
      }
      const diffs = {
        easyScore: 0,
        mediumScore: 0,
        hardScore: 0,
        expertScore: 0,
        [`${difficulty}Score`]: points,
      } as Pick<
        BoardEntry,
        "easyScore" | "mediumScore" | "hardScore" | "expertScore"
      >;
      const localEntry: BoardEntry = {
        id: `local-${norm(name)}`,
        name,
        score: points,
        streak: st,
        mode,
        difficulty,
        ...diffs,
        at: Date.now(),
      };
      const mergedLocal = mergeBoards(readLocalBoard(), [localEntry]);
      writeLocalBoard(mergedLocal);
      setBoard(mergedLocal);
      try {
        const res = await fetch("/api/leaderboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            score: points,
            streak: st,
            mode,
            difficulty,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const remote = Array.isArray(data.scores)
            ? (data.scores as BoardEntry[])
            : [];
          const merged = mergeBoards(mergedLocal, remote);
          writeLocalBoard(merged);
          setBoard(merged);
          setSubmitNote(
            data.updated
              ? "Leaderboard-д хадгаллаа"
              : "Өмнөх онооноос бага байна",
          );
        } else setSubmitNote("Локал хадгаллаа");
      } catch {
        setSubmitNote("Локал хадгаллаа");
      }
    },
    [playerName, mode, difficulty],
  );
  const openBoard = () => {
    setBoardOpen(true);
    setSubmitNote("");
    void refreshBoard();
  };
  const inviteUrl = (code: string) => {
    if (typeof window === "undefined") return `/?p=${code}`;
    return `${window.location.origin}${window.location.pathname}?p=${code}`;
  };
  const applyParty = useCallback((info: PartyRoomInfo, opts?: { soft?: boolean }) => {
    partyCodeRef.current = info.code;
    setParty(info);
    const soft = !!opts?.soft;
    const meName = (nameRef.current || "").toLowerCase();
    const me = meName
      ? info.players.find((p) => p.name.toLowerCase() === meName)
      : undefined;
    const nextMode: Mode =
      info.mode === "foreign" ? "foreign" : "mongolian";
    const nextDiff =
      info.difficulty === "easy" ||
      info.difficulty === "medium" ||
      info.difficulty === "hard" ||
      info.difficulty === "expert"
        ? info.difficulty
        : null;
    const genreRaw = (info.genre || "all") as Genre;
    const allowed =
      nextMode === "mongolian"
        ? !["anime", "jpop", "nineties", "twoThousands"].includes(genreRaw)
        : genreRaw !== "traditional";
    const nextGenre: Genre = allowed ? genreRaw : "all";

    // Lobby/settings + start үед бүгд sync (soft ч гэсэн)
    setMode(nextMode);
    if (nextDiff) setDifficulty(nextDiff);
    setGenre(nextGenre);

    // Зөвхөн гишүүнд track lock — зочин mid-game soft poll-оор lock хийхгүй
    if (info.status !== "lobby" && info.trackIds.length >= 8 && me) {
      setLockedTrackIds((prev) => {
        if (
          prev &&
          prev.length === info.trackIds.length &&
          prev.every((id, i) => id === info.trackIds[i])
        )
          return prev;
        return info.trackIds;
      });
      // Анхны lock үед (soft/hard) progress сэргээнэ — soft poll дахин reset хийхгүй
      if (!partyAppliedRef.current) {
        partyAppliedRef.current = true;
        const done = Math.max(0, Math.min(10, me.roundsDone || 0));
        partyResumeRef.current = done;
        setScore(me.score || 0);
        setStreak(me.streak || 0);
        setRound(done >= 10 ? 10 : Math.max(1, done + 1));
        setPlayedRef.current = info.trackIds.slice(0, done);
      }
    }
    if (!soft) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("p", info.code);
        url.searchParams.delete("c");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, []);
  const refreshParty = useCallback(async (code?: string) => {
    const c = (code || partyCodeRef.current || "").toUpperCase();
    if (!c) return null;
    try {
      const res = await fetch(`/api/party?code=${encodeURIComponent(c)}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = await res.json();
      const info = data.room as PartyRoomInfo;
      applyParty(info, { soft: true });
      return info;
    } catch {
      return null;
    }
  }, [applyParty]);
  const submitPartyScore = useCallback(
    async (points: number, st: number, roundsDone: number) => {
      const code = partyCodeRef.current;
      const name = nameRef.current || playerName;
      if (!code || !name) return;
      try {
        const res = await fetch("/api/party/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            name,
            score: points,
            streak: st,
            roundsDone,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.room) setParty(data.room as PartyRoomInfo);
      } catch {}
    },
    [playerName],
  );
  const createParty = useCallback(
    async (kind: PartyKind) => {
      if (clerkEnabled && !clerkSignedIn) {
        setPartyNote("Game Mode-д нэвтрэх хэрэгтэй");
        return;
      }
      const name = nameRef.current || playerName;
      if (!name || name.length < 2) {
        setNameOpen(true);
        setPartyNote("Эхлээд нэрээ оруул");
        return;
      }
      setPartyBusy(true);
      setPartyNote("");
      try {
        const res = await fetch("/api/party", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hostName: name,
            kind,
            mode,
            genre,
            difficulty,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.room) {
          partyAppliedRef.current = false;
          applyParty(data.room as PartyRoomInfo);
          setPartyNote("Room үүслээ — найзуудаа дууд");
        } else setPartyNote("Room үүсгэж чадсангүй");
      } catch {
        setPartyNote("Room үүсгэж чадсангүй");
      } finally {
        setPartyBusy(false);
      }
    },
    [playerName, mode, genre, difficulty, applyParty, clerkSignedIn],
  );
  const updateLobbySettings = useCallback(
    async (next: { mode: Mode; genre: Genre; difficulty: Difficulty }) => {
      const code = partyCodeRef.current;
      const name = nameRef.current || playerName;
      if (!code || !name) return;
      setMode(next.mode);
      setGenre(next.genre);
      setDifficulty(next.difficulty);
      setPartyBusy(true);
      try {
        const res = await fetch("/api/party", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            hostKey: name,
            mode: next.mode,
            genre: next.genre,
            difficulty: next.difficulty,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.room) {
          applyParty(data.room as PartyRoomInfo, { soft: true });
          setPartyNote("Тохиргоо хадгаллаа");
        } else setPartyNote("Тохиргоо хадгалж чадсангүй");
      } catch {
        setPartyNote("Тохиргоо хадгалж чадсангүй");
      } finally {
        setPartyBusy(false);
      }
    },
    [playerName, applyParty],
  );
  const joinParty = useCallback(
    async (code: string) => {
      if (clerkEnabled && !clerkSignedIn) {
        setPartyNote("Game Mode-д нэвтрэх хэрэгтэй");
        return;
      }
      const name = nameRef.current || playerName;
      if (!name || name.length < 2) {
        setNameOpen(true);
        setPartyNote("Эхлээд нэрээ оруул");
        return;
      }
      setPartyBusy(true);
      setPartyNote("");
      try {
        const res = await fetch("/api/party/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, name }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.room) {
          partyAppliedRef.current = false;
          const room = data.room as PartyRoomInfo;
          applyParty(room);
          if (room.status === "playing") {
            setGameModeOpen(false);
            setPartyNote("Үргэлжлүүллээ");
          } else setPartyNote("Room-д орлоо");
        } else if (data.error === "full") setPartyNote("Room дүүрсэн");
        else if (data.error === "started")
          setPartyNote("Тоглолт эхэлсэн — зөвхөн гишүүд орно");
        else if (data.error === "expired")
          setPartyNote("Room хугацаа дууссан");
        else setPartyNote("Room олдсонгүй");
      } catch {
        setPartyNote("Орж чадсангүй");
      } finally {
        setPartyBusy(false);
      }
    },
    [playerName, applyParty, clerkSignedIn],
  );
  const startParty = useCallback(async () => {
    const name = nameRef.current || playerName;
    const code = partyCodeRef.current;
    if (!code || !name) return;
    if (tracks.filter((t) => t.previewUrl).length < 10) {
      setPartyNote("Дуунууд ачаалагдаж дуусахыг хүлээгээд дахин Эхлэх дар");
      return;
    }
    const ids = pickSetIds(tracks, mode);
    if (ids.length !== 10) {
      setPartyNote("Дууны сан хүрэлцэхгүй байна");
      return;
    }
    setPartyBusy(true);
    try {
      const res = await fetch("/api/party/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          hostKey: name,
          trackIds: ids,
          mode,
          genre,
          difficulty,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.room) {
        partyAppliedRef.current = false;
        applyParty(data.room as PartyRoomInfo);
        setPartyNote("Эхэллээ — тогло!");
        setGameModeOpen(false);
      } else setPartyNote("Эхлүүлж чадсангүй");
    } catch {
      setPartyNote("Эхлүүлж чадсангүй");
    } finally {
      setPartyBusy(false);
    }
  }, [playerName, tracks, mode, genre, difficulty, applyParty]);
  const copyInvite = useCallback(async () => {
    const code = party?.code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1600);
    } catch {
      setPartyNote(inviteUrl(code));
    }
  }, [party]);
  const leaveParty = useCallback(() => {
    partyCodeRef.current = null;
    partyAppliedRef.current = false;
    partyJoinAttemptRef.current = null;
    partyResumeRef.current = 0;
    setParty(null);
    setLockedTrackIds(null);
    setPartyNote("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("p");
      url.searchParams.delete("c");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []);
  const clearRevealUi = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    audio.current?.pause();
    paused.current = false;
    remaining.current = 0;
    setRevealed(false);
    setRevealInfo(null);
    setLastSkipped(null);
    setFireworks([]);
    setSuggestionsOpen(false);
    setGuess("");
    setSelected(null);
    setMessage("");
    setKind("");
  }, []);
  const closeGameMode = useCallback(() => {
    setGameModeOpen(false);
    clearRevealUi();
    // Party дууссан / 10/10 — lock авч solo үргэлжлүүлнэ (load effect дахин ажиллана)
    const done =
      party?.status === "finished" ||
      (!!partyCodeRef.current && round >= 10);
    if (done) {
      leaveParty();
      setScore(0);
      setStreak(0);
      setRound(1);
      setPlayedRef.current = [];
    }
  }, [clearRevealUi, leaveParty, party?.status, round]);
  const setupHotSeat = useCallback(
    (names: string[]) => {
      if (clerkEnabled && !clerkSignedIn) {
        setPartyNote("Game Mode-д нэвтрэх хэрэгтэй");
        return;
      }
      setHotSeatNames(names);
      setHotSeatTurn(0);
      setHotSeatScores(Object.fromEntries(names.map((n) => [n, 0])));
      setPartyNote("");
      setGameModeOpen(false);
      setMessage(`${names[0]}-ийн ээлж`);
      setKind("");
    },
    [clerkSignedIn],
  );
  const exitHotSeat = useCallback(() => {
    setHotSeatNames([]);
    setHotSeatTurn(0);
    setHotSeatScores({});
  }, []);
  const refreshComments = useCallback(async () => {
    setCommentsBusy(true);
    try {
      const res = await fetch("/api/comments", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setComments(
          Array.isArray(data.comments) ? (data.comments as CommentEntry[]) : [],
        );
      }
    } catch {
    } finally {
      setCommentsBusy(false);
    }
  }, []);
  const openComments = () => {
    if (commentsOpen) {
      setCommentsOpen(false);
      return;
    }
    setCommentsOpen(true);
    setSettingsOpen(false);
    setDonateOpen(false);
    setCommentNote("");
    void refreshComments();
  };
  const openSettings = () => {
    if (settingsOpen) {
      setSettingsOpen(false);
      return;
    }
    setSettingsOpen(true);
    setCommentsOpen(false);
    setDonateOpen(false);
  };
  const openDonate = () => {
    if (donateOpen) {
      setDonateOpen(false);
      return;
    }
    setDonateOpen(true);
    setSettingsOpen(false);
    setCommentsOpen(false);
  };
  const closeFabPanels = () => {
    setSettingsOpen(false);
    setCommentsOpen(false);
    setDonateOpen(false);
  };
  useEffect(() => {
    if (!settingsOpen && !commentsOpen && !donateOpen) return;
    const onPointer = (e: MouseEvent | TouchEvent) => {
      const root = fabDock.current;
      if (!root) return;
      const target = e.target as Node | null;
      if (target && !root.contains(target)) closeFabPanels();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [settingsOpen, commentsOpen, donateOpen]);
  const postComment = useCallback(async () => {
    const name = nameRef.current || playerName;
    const body = commentDraft.trim();
    if (!name || name.length < 2) {
      setNameOpen(true);
      setCommentNote("Эхлээд нэрээ оруул");
      return;
    }
    if (body.length < 2) {
      setCommentNote("Сэтгэгдэл бич");
      return;
    }
    setCommentsBusy(true);
    setCommentNote("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments(
          Array.isArray(data.comments) ? (data.comments as CommentEntry[]) : [],
        );
        setCommentDraft("");
        setCommentNote("Илгээгдлээ");
      } else setCommentNote("Илгээж чадсангүй");
    } catch {
      setCommentNote("Илгээж чадсангүй");
    } finally {
      setCommentsBusy(false);
    }
  }, [playerName, commentDraft]);
  const playSfx = useCallback(async (kind: "good" | "bad") => {
    try {
      const AC =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!sfxContext.current) sfxContext.current = new AC();
      const ctx = sfxContext.current;
      if (ctx.state === "suspended") await ctx.resume();
      const t0 = ctx.currentTime;
      const level = Math.max(0.02, sfxVolRef.current);
      const master = ctx.createGain();
      master.gain.value = level;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.85;
      const delay = ctx.createDelay(0.6);
      delay.delayTime.value = 0.14;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.26;
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      const dry = ctx.createGain();
      dry.gain.value = 0.7;
      filter.connect(dry);
      dry.connect(master);
      filter.connect(delay);
      delay.connect(wet);
      wet.connect(master);
      delay.connect(feedback);
      feedback.connect(delay);
      master.connect(ctx.destination);
      const note = (
        freq: number,
        at: number,
        dur: number,
        vol: number,
        type: OscillatorType = "sine",
        slideTo?: number,
      ) => {
        const o = ctx.createOscillator(),
          g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0 + at);
        if (slideTo)
          o.frequency.exponentialRampToValueAtTime(
            Math.max(40, slideTo),
            t0 + at + dur * 0.85,
          );
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.035);
        g.gain.setValueAtTime(vol * 0.9, t0 + at + dur * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        o.connect(g);
        g.connect(filter);
        const h = ctx.createOscillator(),
          hg = ctx.createGain();
        h.type = "triangle";
        h.frequency.setValueAtTime(freq * 2.01, t0 + at);
        if (slideTo)
          h.frequency.exponentialRampToValueAtTime(
            Math.max(80, slideTo * 2),
            t0 + at + dur * 0.85,
          );
        hg.gain.setValueAtTime(0.0001, t0 + at);
        hg.gain.exponentialRampToValueAtTime(vol * 0.22, t0 + at + 0.045);
        hg.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur * 0.88);
        h.connect(hg);
        hg.connect(filter);
        o.start(t0 + at);
        o.stop(t0 + at + dur + 0.04);
        h.start(t0 + at);
        h.stop(t0 + at + dur + 0.04);
      };
      const crackle = (at: number, dur: number, vol: number) => {
        const n = Math.floor(ctx.sampleRate * dur),
          buf = ctx.createBuffer(1, n, ctx.sampleRate),
          data = buf.getChannelData(0);
        for (let i = 0; i < n; i++)
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
        const src = ctx.createBufferSource(),
          g = ctx.createGain(),
          bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 2400;
        bp.Q.value = 1.2;
        src.buffer = buf;
        g.gain.setValueAtTime(0.0001, t0 + at);
        g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
        src.connect(bp);
        bp.connect(g);
        g.connect(filter);
        src.start(t0 + at);
        src.stop(t0 + at + dur + 0.02);
      };
      if (kind === "good") {
        filter.frequency.setValueAtTime(5200, t0);
        filter.frequency.exponentialRampToValueAtTime(2600, t0 + 0.9);
        // fireworks whoosh + sparkle chord
        crackle(0, 0.18, 0.14);
        crackle(0.08, 0.22, 0.1);
        crackle(0.2, 0.16, 0.08);
        [
          [523.25, 0.05, 0.42, 0.11],
          [659.25, 0.14, 0.44, 0.1],
          [783.99, 0.24, 0.46, 0.095],
          [1046.5, 0.34, 0.5, 0.085],
          [1318.5, 0.42, 0.38, 0.05],
        ].forEach(([f, at, dur, vol]) => note(f, at, dur, vol, "sine"));
        note(261.63, 0.04, 0.62, 0.05, "sine");
        note(392, 0.08, 0.55, 0.04, "sine");
        note(523.25, 0.5, 0.35, 0.04, "sine");
      } else {
        filter.frequency.setValueAtTime(2000, t0);
        filter.frequency.exponentialRampToValueAtTime(650, t0 + 0.5);
        feedback.gain.value = 0.14;
        wet.gain.value = 0.2;
        note(349.23, 0, 0.28, 0.075, "sine", 277.18);
        note(277.18, 0.1, 0.34, 0.06, "sine", 220);
        note(220, 0.2, 0.4, 0.045, "triangle", 174.61);
        crackle(0.02, 0.08, 0.035);
      }
    } catch {}
  }, []);
  const burstFireworks = useCallback(() => {
    const bursts = Array.from({ length: 5 }, (_, b) => ({
      id: b,
      x: 18 + Math.random() * 64,
      y: 12 + Math.random() * 48,
      hue: Math.floor(Math.random() * 360),
      delay: b * 0.08,
    }));
    setFireworks(bursts);
    window.setTimeout(() => setFireworks([]), 1800);
  }, []);
  const romajiHitTrack = (t: Track, q: string) => {
    const alts = animeRomajiByCanon[canonicalTitle(t.trackName)] || [];
    return alts.some(
      (a) => canonicalTitle(a).includes(q) || q.includes(canonicalTitle(a)),
    );
  };
  const stopVisualizer = useCallback(() => {
    if (animation.current) cancelAnimationFrame(animation.current);
    animation.current = null;
    wave.current?.querySelectorAll<HTMLElement>(".bar").forEach((bar) => {
      bar.style.removeProperty("height");
      bar.style.removeProperty("opacity");
    });
  }, []);
  const suggestions = useMemo(() => {
    const q = norm(guess);
    if (q.length < 2) return [];
    const pool = [...(current ? [current] : []), ...tracks];
    const candidates = pool.filter(
      (t) =>
        norm(t.trackName).includes(q) ||
        norm(t.artistName).includes(q) ||
        canonicalTitle(t.trackName).includes(q) ||
        animeHit(t, q) ||
        romajiHitTrack(t, q),
    );
    const byKey = new Map<string, Track>();
    for (const t of candidates) {
      const key = `${canonicalTitle(t.trackName)}|${norm(t.artistName)}`;
      const prev = byKey.get(key);
      if (!prev || titleCleaner(t) < titleCleaner(prev)) byKey.set(key, t);
    }
    const unique = [...byKey.values()];
    const ranked = unique.map((t) => {
      const artist = norm(t.artistName),
        title = canonicalTitle(t.trackName),
        anime = norm(animeOf(t) || "");
      const penalty =
        (edition.test(t.trackName) ? 10 : 0) +
        (featMark.test(t.trackName) ? 8 : 0);
      const rank =
        (title.startsWith(q)
          ? 0
          : title.includes(q)
            ? 1
            : anime.includes(q) || animeHit(t, q)
              ? 2
              : artist === q
                ? 3
                : artist.startsWith(q)
                  ? 4
                  : artist.includes(q)
                    ? 5
                    : 6) + penalty;
      return { t, rank };
    });
    const groups = new Map<number, Track[]>();
    for (const row of ranked) {
      const list = groups.get(row.rank) || [];
      list.push(row.t);
      groups.set(row.rank, list);
    }
    const seed = `${q}|${current?.trackId ?? ""}`;
    let out = [...groups.keys()]
      .sort((a, b) => a - b)
      .flatMap((rank) =>
        seededShuffle(groups.get(rank) || [], `${seed}|${rank}`),
      );
    const MIN = 5;
    if (out.length < MIN && pool.length > out.length) {
      const seen = new Set(
        out.map((t) => `${canonicalTitle(t.trackName)}|${norm(t.artistName)}`),
      );
      const decoys: Track[] = [];
      for (const t of seededShuffle(pool, `${seed}|decoy`)) {
        const key = `${canonicalTitle(t.trackName)}|${norm(t.artistName)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        decoys.push(t);
        if (out.length + decoys.length >= MIN) break;
      }
      out = seededShuffle([...out, ...decoys], `${seed}|mix`);
    }
    return out.slice(0, 8);
  }, [guess, tracks, current]);
  const startVisualizer = useCallback(async () => {
    const a = audio.current,
      w = wave.current;
    if (!a || !w) return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!audioContext.current) audioContext.current = new AudioContextClass();
      const ctx = audioContext.current;
      if (ctx.state === "suspended") await ctx.resume();
      if (!mediaSource.current) {
        mediaSource.current = ctx.createMediaElementSource(a);
        analyser.current = ctx.createAnalyser();
        analyser.current.fftSize = 128;
        analyser.current.smoothingTimeConstant = 0.78;
        mediaSource.current.connect(analyser.current);
        analyser.current.connect(ctx.destination);
      }
      w.classList.remove("fallback");
      const bars = [...w.querySelectorAll<HTMLElement>(".bar")],
        data = new Uint8Array(analyser.current!.frequencyBinCount);
      const tick = () => {
        analyser.current!.getByteFrequencyData(data);
        bars.forEach((bar, i) => {
          const mirrored =
            i < bars.length / 2 ? bars.length / 2 - 1 - i : i - bars.length / 2;
          const bin = Math.min(
            data.length - 1,
            Math.floor((mirrored * data.length) / (bars.length / 2)),
          );
          const power = data[bin] / 255;
          bar.style.height = 10 + power * 108 + "px";
          bar.style.opacity = String(0.28 + power * 0.72);
        });
        animation.current = requestAnimationFrame(tick);
      };
      stopVisualizer();
      tick();
    } catch {
      w.classList.add("fallback");
    }
  }, [stopVisualizer]);
  const finish = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    stopVisualizer();
    remaining.current = 0;
    paused.current = false;
    audio.current?.pause();
    setPlaying(false);
  }, [stopVisualizer]);
  const takeNext = useCallback((list: Track[]) => {
    const [item, ...rest] = list;
    if (!item) return false;
    if (timer.current) clearTimeout(timer.current);
    audio.current?.pause();
    try {
      const old: number[] = JSON.parse(
        localStorage.getItem("duuTaayaRecent") || "[]",
      );
      localStorage.setItem(
        "duuTaayaRecent",
        JSON.stringify(
          [item.trackId, ...old.filter((x) => x !== item.trackId)].slice(0, 40),
        ),
      );
    } catch {}
    setPlayedRef.current = [...setPlayedRef.current, item.trackId].slice(-10);
    setCurrent(item);
    setTracks(rest);
    setLevel(0);
    setGuess("");
    setSelected(null);
    setSuggestionsOpen(false);
    setRevealed(false);
    setRevealInfo(null);
    setMessage("");
    setKind("");
    remaining.current = 0;
    paused.current = false;
    return true;
  }, []);
  const loadByTrackIds = useCallback(
    async (ids: number[], playMode: Mode) => {
      setLoading(true);
      setMessage("");
      setKind("");
      setLastSkipped(null);
      const country = playMode === "foreign" ? "us" : "au";
      try {
        const res = await fetch(
          `https://itunes.apple.com/lookup?id=${ids.join(",")}&entity=song&country=${country}`,
        );
        const data = await res.json();
        const byId = new Map<number, Track>();
        for (const x of (data.results || []) as Track[]) {
          if (
            x.wrapperType === "track" &&
            x.previewUrl &&
            x.trackName &&
            x.artistName
          )
            byId.set(x.trackId, x);
        }
        const list = ids.map((id) => byId.get(id)).filter(Boolean) as Track[];
        if (list.length < 8) throw Error("short");
        const resume = Math.max(
          0,
          Math.min(partyResumeRef.current, list.length),
        );
        partyResumeRef.current = 0;
        setPlayedRef.current = list.slice(0, resume).map((t) => t.trackId);
        const remaining = list.slice(resume);
        if (remaining.length === 0) {
          setMessage("Party дууссан — оноо харна");
          setKind("good");
          setGameModeOpen(true);
          return;
        }
        if (!takeNext(remaining)) throw Error();
      } catch {
        setMessage("Party дуу ачаалж чадсангүй");
        setKind("bad");
      } finally {
        setLoading(false);
      }
    },
    [takeNext],
  );
  const load = useCallback(async () => {
    if (!bootReady) return;
    if (lockedTrackIds && lockedTrackIds.length >= 8) {
      await loadByTrackIds(lockedTrackIds, mode);
      return;
    }
    setLoading(true);
    setMessage("");
    setKind("");
    setLastSkipped(null);
    const pools = mode === "mongolian" ? mongolianPools : foreignPools,
      featured = mode === "mongolian" ? mongolianFeatured : foreignFeatured;
    const ids =
        genre === "all" || genre === "new"
          ? [
              ...new Set(
                Object.entries(pools)
                  .filter(([k]) => !eraOnly.has(k as Genre))
                  .flatMap(([, v]) => v),
              ),
            ]
          : (pools as Record<string, number[]>)[genre] || [],
      featuredIds =
        genre === "all" || genre === "new"
          ? [...new Set(Object.values(featured).flat())]
          : (featured as Record<string, number[]>)[genre] || [],
      artists = new Set(ids),
      songs = new Set(featuredIds),
      country = mode === "foreign" ? "us" : "au";
    try {
      const calls = ids.map((id) =>
        fetch(
          `https://itunes.apple.com/lookup?id=${id}&entity=song&limit=100&country=${country}`,
        )
          .then((r) => r.json())
          .catch(() => ({ results: [] })),
      );
      if (featuredIds.length)
        calls.push(
          fetch(
            `https://itunes.apple.com/lookup?id=${featuredIds.join(",")}&entity=song&country=${country}`,
          )
            .then((r) => r.json())
            .catch(() => ({ results: [] })),
        );
      const data = await Promise.all(calls);
      let list: Track[] = data
        .flatMap((x) => x.results || [])
        .filter(
          (x: Track) =>
            x.wrapperType === "track" &&
            x.previewUrl &&
            x.trackName &&
            x.artistName &&
            (artists.has(Number(x.artistId)) || songs.has(Number(x.trackId))),
        );
      list = list.filter(
        (x) => !instrumental.test(`${x.trackName} ${x.collectionName || ""}`),
      );
      list = [...new Map(list.map((x) => [x.trackId, x])).values()];
      if (genre === "new")
        list = list.filter(
          (x) =>
            x.releaseDate && new Date(x.releaseDate) >= new Date("2023-01-01"),
        );
      if (genre === "nineties")
        list = list.filter((x) => {
          const y = releaseYear(x);
          return (
            y != null && y >= 1990 && y < 2000 && !edition.test(x.trackName)
          );
        });
      if (genre === "twoThousands")
        list = list.filter((x) => {
          const y = releaseYear(x);
          return (
            y != null && y >= 2000 && y < 2010 && !edition.test(x.trackName)
          );
        });
      list = shuffle(list);
      let recent = new Set<number>();
      try {
        recent = new Set(
          JSON.parse(localStorage.getItem("duuTaayaRecent") || "[]"),
        );
      } catch {}
      list.sort(
        (a, b) => Number(recent.has(a.trackId)) - Number(recent.has(b.trackId)),
      );
      setPlayedRef.current = [];
      if (!takeNext(list)) throw Error();
    } catch {
      setMessage("Ачаалж чадсангүй");
      setKind("bad");
    } finally {
      setLoading(false);
    }
  }, [
    bootReady,
    lockedTrackIds,
    loadByTrackIds,
    mode,
    genre,
    takeNext,
  ]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const payment = params.get("payment");
        if (payment === "success" || params.get("donated") === "1") {
          setDonateBanner("success");
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("donated");
            url.searchParams.delete("donate");
            url.searchParams.delete("payment");
            window.history.replaceState({}, "", url.toString());
          } catch {}
        } else if (
          payment === "cancelled" ||
          params.get("donate") === "cancel"
        ) {
          setDonateBanner("cancelled");
          try {
            const url = new URL(window.location.href);
            url.searchParams.delete("donate");
            url.searchParams.delete("payment");
            window.history.replaceState({}, "", url.toString());
          } catch {}
        }
        const raw = (params.get("p") || params.get("c") || "")
          .trim()
          .toUpperCase();
        if (raw) {
          const res = await fetch(
            `/api/party?code=${encodeURIComponent(raw)}`,
            { cache: "no-store" },
          );
          if (res.ok) {
            const data = await res.json();
            if (!cancelled && data.room) {
              const info = data.room as PartyRoomInfo;
              partyAppliedRef.current = false;
              applyParty(info);
              if (info.status === "lobby") {
                setGameModeOpen(true);
                setPartyNote(
                  clerkEnabled
                    ? "Нэвтэрээд room-д орно уу"
                    : "Room lobby — нэвтэрээд нэгд",
                );
              } else if (info.status === "finished") {
                setGameModeOpen(true);
                setPartyNote("Энэ room дууссан");
              } else {
                // Playing: panel нээлттэй үлдээнэ — auth/join дуустал
                setGameModeOpen(true);
                setPartyNote("Тоглолт явж байна — нэвтэрээд үргэлжлүүлнэ");
              }
            }
          } else if (!cancelled) {
            setPartyNote("Room олдсонгүй эсвэл дууссан");
            setGameModeOpen(true);
          }
        }
      } catch {
      } finally {
        if (!cancelled) setBootReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyParty]);
  useEffect(() => {
    if (!donateBanner) return;
    const id = window.setTimeout(() => setDonateBanner(null), 8000);
    return () => window.clearTimeout(id);
  }, [donateBanner]);
  useEffect(() => {
    if (!bootReady || !partyAuthed) return;
    const name = nameRef.current || playerName;
    if (!name || name.length < 2) return;
    const code = partyCodeRef.current;
    if (!code) return;
    const alreadyIn = party?.players.some(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (alreadyIn) {
      // Нэр хожуу ирвэл / track lock алдагдвал resume дахин хийнэ
      if (
        party &&
        party.status !== "lobby" &&
        (!partyAppliedRef.current || !lockedTrackIds?.length)
      ) {
        partyAppliedRef.current = false;
        applyParty(party);
        if (party.status === "playing") setGameModeOpen(false);
      }
      return;
    }
    if (party?.status === "finished") return;
    const attemptKey = `${code}|${name.toLowerCase()}`;
    if (partyJoinAttemptRef.current === attemptKey) return;
    partyJoinAttemptRef.current = attemptKey;
    void joinParty(code);
  }, [
    bootReady,
    partyAuthed,
    playerName,
    party,
    lockedTrackIds,
    joinParty,
    applyParty,
  ]);
  useEffect(() => {
    if (!bootReady) return;
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load, bootReady]);
  useEffect(() => {
    if (!partyCodeRef.current) return;
    if (party?.status === "finished") return;
    const id = setInterval(() => {
      void refreshParty();
    }, 2500);
    return () => clearInterval(id);
  }, [party?.status, party?.code, refreshParty]);
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (searchbox.current && !searchbox.current.contains(e.target as Node))
        setSuggestionsOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const play = (restart = false, requestedLevel = level) => {
    const a = audio.current;
    if (!a || !current) return;
    if (!restart && !paused.current && remaining.current > 0) {
      remaining.current = Math.max(
        0,
        remaining.current - (performance.now() - started.current),
      );
      paused.current = true;
      if (timer.current) clearTimeout(timer.current);
      stopVisualizer();
      a.pause();
      setPlaying(false);
      return;
    }
    if (restart) {
      if (timer.current) clearTimeout(timer.current);
      stopVisualizer();
      a.pause();
      paused.current = false;
      remaining.current = 0;
    }
    if (!paused.current || remaining.current <= 0) {
      a.currentTime = cuePoints[current.trackId] ?? 2.5;
      remaining.current = limits[requestedLevel] * 1000;
    }
    void startVisualizer();
    a.play()
      .then(() => {
        started.current = performance.now();
        paused.current = false;
        setPlaying(true);
        timer.current = setTimeout(finish, remaining.current);
      })
      .catch(() => {
        setMessage("Тоглож чадсангүй");
        setKind("bad");
      });
  };
  const listenCache = useRef(
    new Map<string, { spotify: string; youtube: string }>(),
  );
  const resolveListenLinksCached = useCallback(async (t: Track) => {
    const key = `${t.trackId}`;
    const hit = listenCache.current.get(key);
    if (hit) return hit;
    const links = await resolveListenLinks(t);
    listenCache.current.set(key, links);
    return links;
  }, []);
  useEffect(() => {
    if (!current) return;
    void resolveListenLinksCached(current);
  }, [current, resolveListenLinksCached]);
  const snapshot = (
    t: Track,
    ok: boolean,
    links?: { spotify: string; youtube: string },
  ) => {
    const anime = animeOf(t),
      romaji = romajiOf(t);
    const cached = listenCache.current.get(String(t.trackId));
    return {
      trackName: t.trackName,
      artistName: t.artistName,
      romaji,
      anime,
      spotify: links?.spotify || cached?.spotify || spotifySearchUrl(t),
      youtube: links?.youtube || cached?.youtube || youtubeSearchUrl(t),
      artwork: t.artworkUrl100,
      ok,
    };
  };
  const reveal = (ok: boolean) => {
    if (!current) return;
    finish();
    void playSfx(ok ? "good" : "bad");
    if (ok) burstFireworks();
    const track = current;
    const info = snapshot(track, ok);
    setRevealInfo(info);
    if (!ok) setLastSkipped(info);
    setRevealed(true);
    setSuggestionsOpen(false);
    setMessage("");
    setKind(ok ? "good" : "bad");
    void resolveListenLinksCached(track).then((links) => {
      const next = snapshot(track, ok, links);
      setRevealInfo((prev) =>
        prev &&
        prev.trackName === track.trackName &&
        prev.artistName === track.artistName
          ? next
          : prev,
      );
      if (!ok)
        setLastSkipped((prev) =>
          prev &&
          prev.trackName === track.trackName &&
          prev.artistName === track.artistName
            ? {
                trackName: next.trackName,
                artistName: next.artistName,
                romaji: next.romaji,
                anime: next.anime,
                spotify: next.spotify,
                youtube: next.youtube,
              }
            : prev,
        );
    });
    const endOfSet = round >= 10;
    const inParty = !!partyCodeRef.current;
    setTimeout(() => {
      if (hotSeatNames.length > 0) {
        const name = hotSeatNames[hotSeatTurn % hotSeatNames.length];
        if (ok) {
          const base = Math.max(20, 100 - level * 20);
          const mult =
            difficulty === "easy"
              ? 0.6
              : difficulty === "medium"
                ? 1
                : difficulty === "hard"
                  ? 1.6
                  : 2.2;
          const pts = Math.round(base * mult);
          setHotSeatScores((prev) => ({
            ...prev,
            [name]: (prev[name] || 0) + pts,
          }));
        }
        const nextTurn = hotSeatTurn + 1;
        setHotSeatTurn(nextTurn);
        const nextName = hotSeatNames[nextTurn % hotSeatNames.length];
        setMessage(`${nextName}-ийн ээлж`);
        setKind("");
      }
      const completed = setPlayedRef.current.length;
      if (partyCodeRef.current) {
        void submitPartyScore(
          scoreRef.current,
          streakRef.current,
          endOfSet ? 10 : completed,
        );
      }
      if (endOfSet) {
        lastSetIdsRef.current = [...setPlayedRef.current];
        lastSetScoreRef.current = scoreRef.current;
        lastSetStreakRef.current = streakRef.current;
        if (inParty) {
          clearRevealUi();
          setGameModeOpen(true);
          setPartyNote("10/10 дууссан — оноогоо харна уу");
          setBoardOpen(false);
          setRound(10);
          return;
        }
        void submitScore(false);
        setBoardOpen(true);
        setScore(0);
        setStreak(0);
        setPlayedRef.current = [];
        setRound(1);
        if (!takeNext(tracks)) void load();
        return;
      }
      setRound((r) => r + 1);
      if (!takeNext(tracks)) void load();
    }, 3800);
  };
  const submit = () => {
    if (!current || revealed) return;
    const q = norm(guess);
    if (q.length < 2) {
      void playSfx("bad");
      setMessage("Нэрээ бич");
      setKind("bad");
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }
    const picked =
      selected == null
        ? null
        : ([current, ...tracks].find((t) => t.trackId === selected) ?? null);
    const ok = guessCorrect(guess, current, picked, selected);
    if (ok) {
      const base = Math.max(20, 100 - level * 20);
      const mult =
        difficulty === "easy"
          ? 0.6
          : difficulty === "medium"
            ? 1
            : difficulty === "hard"
              ? 1.6
              : 2.2;
      setScore((s) => s + Math.round(base * mult));
      setStreak((s) => s + 1);
      reveal(true);
    } else {
      void playSfx("bad");
      setStreak(0);
      setMessage("Буруу");
      setKind("bad");
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
  };
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bumpVolRef = useRef<(d: number) => void>(() => {});
  const bumpVol = (delta: number) => {
    setVolume((v) =>
      Math.min(1, Math.max(0, Math.round((v + delta) * 20) / 20)),
    );
    if (volTimer.current) clearTimeout(volTimer.current);
    setVolPulse(true);
    volTimer.current = setTimeout(() => setVolPulse(false), 280);
  };
  bumpVolRef.current = bumpVol;
  const bumpSfx = (delta: number) => {
    setSfxVolume((v) => {
      const n = Math.min(1, Math.max(0, Math.round((v + delta) * 20) / 20));
      sfxVolRef.current = n;
      return n;
    });
    setSfxPulse(true);
    window.setTimeout(() => setSfxPulse(false), 280);
  };
  const scrubVol = (
    e: React.PointerEvent<HTMLDivElement>,
    vertical: boolean,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = vertical
      ? 1 - (e.clientY - rect.top) / Math.max(rect.height, 1)
      : (e.clientX - rect.left) / Math.max(rect.width, 1);
    setVolume(Math.min(1, Math.max(0, Math.round(raw * 20) / 20)));
    if (volTimer.current) clearTimeout(volTimer.current);
    setVolPulse(true);
    volTimer.current = setTimeout(() => setVolPulse(false), 280);
  };
  const scrubSfx = (
    e: React.PointerEvent<HTMLDivElement>,
    vertical: boolean,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = vertical
      ? 1 - (e.clientY - rect.top) / Math.max(rect.height, 1)
      : (e.clientX - rect.left) / Math.max(rect.width, 1);
    const n = Math.min(1, Math.max(0, Math.round(raw * 20) / 20));
    sfxVolRef.current = n;
    setSfxVolume(n);
    setSfxPulse(true);
    window.setTimeout(() => setSfxPulse(false), 280);
  };
  const bumpSfxRef = useRef(bumpSfx);
  bumpSfxRef.current = bumpSfx;
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const el = (e.target as Element | null)?.closest?.(".vol-ctrl");
      if (!el) return;
      e.preventDefault();
      const delta = e.deltaY < 0 || e.deltaX < 0 ? 0.05 : -0.05;
      if (el.classList.contains("sfx")) bumpSfxRef.current(delta);
      else bumpVolRef.current(delta);
    };
    document.addEventListener("wheel", onWheel, {
      passive: false,
      capture: true,
    });
    return () => document.removeEventListener("wheel", onWheel, true);
  }, []);
  const volCtrl = (vertical: boolean, kind: "music" | "sfx") => {
    const isSfx = kind === "sfx",
      val = isSfx ? sfxVolume : volume,
      pulse = isSfx ? sfxPulse : volPulse;
    return (
      <div
        className={`vol-ctrl ${vertical ? "vert" : "horiz"} ${isSfx ? "sfx" : "music"} ${pulse ? "pulse" : ""}`}
      >
        <span className="vol-tag">{isSfx ? "SFX" : "♪"}</span>
        <button
          type="button"
          className="vol-btn"
          aria-label="Багасгах"
          onClick={() => (isSfx ? bumpSfx(-0.05) : bumpVol(-0.05))}
        >
          −
        </button>
        <div
          className="vol-meter"
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(val * 100)}
          aria-label={isSfx ? "SFX чанга" : "Дууны чанга"}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            (isSfx ? scrubSfx : scrubVol)(e, vertical);
          }}
          onPointerMove={(e) => {
            if (e.buttons) (isSfx ? scrubSfx : scrubVol)(e, vertical);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowRight") {
              e.preventDefault();
              isSfx ? bumpSfx(0.05) : bumpVol(0.05);
            }
            if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
              e.preventDefault();
              isSfx ? bumpSfx(-0.05) : bumpVol(-0.05);
            }
          }}
        >
          <i
            style={
              { "--p": `${Math.round(val * 100)}%` } as React.CSSProperties
            }
          />
        </div>
        <button
          type="button"
          className="vol-btn"
          aria-label="Нэмэх"
          onClick={() => (isSfx ? bumpSfx(0.05) : bumpVol(0.05))}
        >
          +
        </button>
        <span className="vol-pct">{Math.round(val * 100)}</span>
      </div>
    );
  };
  return (
    <main className="shell">
      {donateBanner && (
        <div
          className={`donate-banner ${donateBanner === "success" ? "good" : "bad"}`}
          role="status"
        >
          <p>
            {donateBanner === "success"
              ? "Төлбөр амжилттай. Дуугаа Таа-г дэмжсэнд баярлалаа!"
              : "Төлбөр цуцлагдлаа. Хүсвэл дахин оролдоорой."}
          </p>
          <button
            type="button"
            className="donate-banner-x"
            aria-label="Хаах"
            onClick={() => setDonateBanner(null)}
          >
            ×
          </button>
        </div>
      )}
      <aside className="rail">
        <div className="brand">
          <span className="mark">♫</span>
          <span>Дуугаа Таа</span>
        </div>
        <div className="rail-block">
          <div className="difficulty">
            {(["easy", "medium", "hard", "expert"] as Difficulty[]).map((d) => (
              <button
                key={d}
                className={`diff ${difficulty === d ? "active" : ""}`}
                onClick={() => {
                  if (lockedTrackIds) return;
                  setDifficulty(d);
                  setLevel(0);
                }}
                disabled={!!lockedTrackIds}
              >
                {diffLabel[d]}
              </button>
            ))}
          </div>
        </div>
        {clerkEnabled && (
          <ClerkIdentityBridge onIdentity={onClerkIdentity} />
        )}
        {clerkEnabled ? (
          <>
            <Show when="signed-in">
              <div className="name-chip name-chip-auth" title="Clerk хаяг">
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: { width: 28, height: 28 },
                    },
                  }}
                />
                <span>{playerName || "User"}</span>
              </div>
            </Show>
            <Show when="signed-out">
              <div className="auth-rail">
                <SignInButton mode="modal">
                  <button type="button" className="auth-signin">
                    Нэвтрэх
                  </button>
                </SignInButton>
                <button
                  className="name-chip"
                  type="button"
                  onClick={() => {
                    setNameDraft(playerName);
                    setNameOpen(true);
                  }}
                  title="Зочны нэр"
                >
                  {playerName || "Зочин"}
                </button>
              </div>
            </Show>
          </>
        ) : (
          <button
            className="name-chip"
            type="button"
            onClick={() => {
              setNameDraft(playerName);
              setNameOpen(true);
            }}
            title="Нэр солих"
          >
            {playerName || "Нэр?"}
          </button>
        )}
        <button
          className="reset"
          onClick={() => {
            setScore(0);
            setStreak(0);
            setRound(1);
            load();
          }}
          title="Шинээр"
        >
          ↻
        </button>
      </aside>

      <section className="stage">
        <header className="hud">
          <div className="pills">
            <button
              className={`pill ${mode === "mongolian" ? "on" : ""}`}
              disabled={!!lockedTrackIds}
              onClick={() => {
                if (lockedTrackIds) return;
                setMode("mongolian");
                setGenre("all");
                setScore(0);
                setStreak(0);
                setRound(1);
              }}
            >
              Монгол
            </button>
            <button
              className={`pill ${mode === "foreign" ? "on" : ""}`}
              disabled={!!lockedTrackIds}
              onClick={() => {
                if (lockedTrackIds) return;
                setMode("foreign");
                setGenre("all");
                setScore(0);
                setStreak(0);
                setRound(1);
              }}
            >
              Гадаад
            </button>
          </div>
          <div className="hud-right">
            <div className="stats">
              <b>{score}</b>
              <span>оноо</span>
              <i />
              <b>{streak}</b>
              <span>streak</span>
              <i />
              <b>{round}/10</b>
            </div>
            <button
              className="board-btn hud-trophy"
              type="button"
              onClick={openBoard}
              title="Leaderboard"
              aria-label="Leaderboard"
            >
              🏆
            </button>
            <button
              className="board-btn hud-challenge"
              type="button"
              onClick={() => {
                setPartyNote("");
                setGameModeOpen(true);
              }}
              title="Хамт тоглох"
              aria-label="Хамт тоглох"
            >
              ◈
            </button>
          </div>
        </header>

        <nav className="genres">
          {visibleGenres(mode).map((g) => (
            <button
              key={g}
              className={`chip ${genre === g ? "active" : ""}`}
              disabled={!!lockedTrackIds}
              onClick={() => {
                if (lockedTrackIds) return;
                setGenre(g);
                setRound(1);
              }}
            >
              {genreLabel(g)}
            </button>
          ))}
        </nav>

        <h1 className="logo">Дуугаа Таа</h1>

        <div className={`wave ${playing ? "playing" : ""}`} ref={wave}>
          {Array.from({ length: 40 }, (_, i) => (
            <i
              className="bar"
              key={i}
              style={
                {
                  "--i": i,
                  "--h": `${14 + ((i * 41) % 82)}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>

        <button
          className={`play ${playing ? "on" : ""}`}
          disabled={loading}
          onClick={() => play()}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <div className="secs">
          <b>{limits[level]}</b>s
        </div>
        <div className="steps">
          {limits.map((_, i) => (
            <i key={i} className={`step ${i <= level ? "on" : ""}`} />
          ))}
        </div>

        <div className={`answer-wrap ${shaking ? "shake" : ""}`}>
          <div
            className={`answer ${suggestionsOpen && suggestions.length > 0 ? "open" : ""}`}
          >
            <div className="searchbox" ref={searchbox}>
              {suggestionsOpen && suggestions.length > 0 && (
                <ul className="suggestions" role="listbox">
                  {suggestions.map((t) => {
                    const anime = animeOf(t),
                      romaji = romajiOf(t);
                    return (
                      <li key={t.trackId}>
                        <button
                          type="button"
                          className="suggestion"
                          role="option"
                          onClick={() => {
                            setSelected(t.trackId);
                            setGuess(romaji || t.trackName);
                            setSuggestionsOpen(false);
                          }}
                        >
                          <b>{romaji || t.trackName}</b>
                          {romaji && t.trackName !== romaji && (
                            <em>{t.trackName}</em>
                          )}
                          <span>
                            {t.artistName}
                            {anime ? ` · ${anime}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <input
                value={guess}
                onFocus={() => setSuggestionsOpen(true)}
                onChange={(e) => {
                  setGuess(e.target.value);
                  setSelected(null);
                  setSuggestionsOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setSuggestionsOpen(false);
                }}
                autoComplete="off"
                spellCheck={false}
                placeholder="Romaji / дууны нэр…"
              />
            </div>
            <button className="go" type="button" onClick={submit}>
              Таах
            </button>
          </div>
        </div>

        <div className="actions">
          <button
            className="ghost"
            onClick={() => {
              if (level < limits.length - 1) {
                const n = level + 1;
                setLevel(n);
                play(true, n);
              } else setMessage("Max");
            }}
          >
            + Сонсох
          </button>
          <button
            className="ghost"
            onClick={() => {
              setStreak(0);
              finish();
              reveal(false);
            }}
          >
            Skip
          </button>
        </div>

        {message && <p className={`message ${kind}`}>{message}</p>}

        {!revealed && lastSkipped && (
          <div className="prev-skip">
            <span className="prev-skip-label">Өмнөх skip</span>
            <p className="prev-skip-title">
              {lastSkipped.romaji || lastSkipped.trackName}
            </p>
            <p className="prev-skip-meta">
              {lastSkipped.artistName}
              {lastSkipped.anime ? ` · ${lastSkipped.anime}` : ""}
            </p>
            <div className="listen-row compact">
              <a
                className="listen spotify"
                href={lastSkipped.spotify}
                target="_blank"
                rel="noopener noreferrer"
                title="Spotify"
                aria-label="Spotify"
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                  />
                </svg>
              </a>
              <a
                className="listen youtube"
                href={lastSkipped.youtube}
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube"
                aria-label="YouTube"
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z"
                  />
                </svg>
              </a>
            </div>
          </div>
        )}

        {revealed && revealInfo && (
          <div className="reveal-overlay" role="dialog" aria-modal="true">
            {revealInfo.ok && fireworks.length > 0 && (
              <div className="fw-layer" aria-hidden>
                {fireworks.map((burst) => (
                  <div
                    key={burst.id}
                    className="fw-burst"
                    style={
                      {
                        "--x": `${burst.x}%`,
                        "--y": `${burst.y}%`,
                        "--hue": burst.hue,
                        "--d": `${burst.delay}s`,
                      } as React.CSSProperties
                    }
                  >
                    {Array.from({ length: 18 }, (_, i) => (
                      <i
                        key={i}
                        className="fw-spark"
                        style={{ "--a": `${i * 20}deg` } as React.CSSProperties}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className={`reveal ${kind}`}>
              <small>{revealInfo.ok ? "ЗӨВ" : "ХАРИУЛТ"}</small>
              {revealInfo.anime && (
                <p className="reveal-anime reveal-anime-top">
                  <span className="reveal-anime-label">Anime</span>
                  {revealInfo.anime}
                </p>
              )}
              {revealInfo.artwork && (
                <img
                  src={revealInfo.artwork.replace("100x100", "300x300")}
                  alt=""
                />
              )}
              <strong>{revealInfo.trackName}</strong>
              {revealInfo.romaji &&
                revealInfo.romaji !== revealInfo.trackName && (
                  <p className="reveal-romaji">{revealInfo.romaji}</p>
                )}
              <span>{revealInfo.artistName}</span>
              <div className="listen-row">
                <a
                  className="listen spotify"
                  href={revealInfo.spotify}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
                    />
                  </svg>
                  Spotify
                </a>
                <a
                  className="listen youtube"
                  href={revealInfo.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="currentColor"
                      d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z"
                    />
                  </svg>
                  YouTube
                </a>
              </div>
              <em>Бүтнээр нь сонсох бол дээр дар</em>
            </div>
          </div>
        )}

        {nameOpen && (
          <div className="board-overlay" role="dialog" aria-modal="true">
            <div className="board-card name-card">
              <small>ТОГЛОГЧ</small>
              <strong>
                {clerkEnabled ? "Нэвтэр эсвэл зочиноор тогло" : "Leaderboard нэр"}
              </strong>
              {clerkEnabled && (
                <div className="auth-row">
                  <SignInButton mode="modal">
                    <button type="button" className="go auth-clerk">
                      Нэвтрэх
                    </button>
                  </SignInButton>
                  <p className="board-meta auth-hint">
                    Шинэ хэрэглэгч бол нэвтрэх цонхноос Sign up дар
                  </p>
                </div>
              )}
              <p className="board-meta auth-or">
                {clerkEnabled ? "эсвэл зочны нэр" : "Нэрээ бичнэ үү"}
              </p>
              <input
                value={nameDraft}
                maxLength={16}
                autoFocus
                placeholder="Жнь: Hoso"
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (cleanName(nameDraft).length >= 2) saveName(nameDraft);
                    else continueAsGuest();
                  }
                }}
              />
              <div className="board-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => continueAsGuest()}
                >
                  Зочиноор тоглох
                </button>
                <button
                  type="button"
                  className="go"
                  onClick={() => {
                    if (cleanName(nameDraft).length >= 2) saveName(nameDraft);
                    else continueAsGuest(nameDraft);
                  }}
                >
                  Үргэлжлүүлэх
                </button>
              </div>
            </div>
          </div>
        )}

        {boardOpen && (
          <div
            className="board-overlay"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setBoardOpen(false);
            }}
          >
            <div className="board-card">
              <div className="board-head">
                <div>
                  <small>LEADERBOARD</small>
                  <strong>Top тоглогчид</strong>
                </div>
                <button
                  type="button"
                  className="board-close"
                  onClick={() => setBoardOpen(false)}
                  aria-label="Хаах"
                >
                  ×
                </button>
              </div>
              <p className="board-meta">
                {playerName
                  ? `Та: ${playerName} · ${score} оноо`
                  : "Нэрээ оруулна уу"}
              </p>
              <div className="board-list">
                {boardBusy && board.length === 0 && (
                  <p className="board-empty">Ачаалж байна…</p>
                )}
                {!boardBusy && board.length === 0 && (
                  <p className="board-empty">
                    Одоогоор хоосон. 10 дуу таагаад оноогоо илгээгээрэй.
                  </p>
                )}
                {board.map((e, i) => {
                  const d = diffScores(e);
                  const parts = (
                    [
                      ["Easy", d.easyScore],
                      ["Med", d.mediumScore],
                      ["Hard", d.hardScore],
                      ["Xprt", d.expertScore],
                    ] as const
                  ).filter(([, n]) => n > 0);
                  return (
                    <div
                      key={e.id || `${e.name}-${i}`}
                      className={`board-row ${playerName && e.name.toLowerCase() === playerName.toLowerCase() ? "me" : ""}`}
                    >
                      <span className="board-rank">{i + 1}</span>
                      <div className="board-main">
                        <span className="board-name">{e.name}</span>
                        {parts.length > 0 && (
                          <span className="board-diffs">
                            {parts.map(([label, n]) => (
                              <span key={label}>
                                {label} {n}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                      <span className="board-score">{e.score}</span>
                    </div>
                  );
                })}
              </div>
              {submitNote && <p className="board-note">{submitNote}</p>}
              {hotSeatNames.length > 0 && (
                <div className="board-list" style={{ marginTop: 8 }}>
                  {hotSeatNames.map((n, i) => (
                    <div
                      key={`${n}-${i}`}
                      className={`board-row ${i === hotSeatTurn % hotSeatNames.length ? "me" : ""}`}
                    >
                      <span className="board-rank">{i + 1}</span>
                      <span className="board-name">{n}</span>
                      <span className="board-score">
                        {hotSeatScores[n] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="board-actions">
                <button
                  type="button"
                  className="ghost"
                  onClick={() => void refreshBoard()}
                  disabled={boardBusy}
                >
                  Шинэчлэх
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    setBoardOpen(false);
                    setGameModeOpen(true);
                  }}
                >
                  Хамт тоглох
                </button>
                <button
                  type="button"
                  className="go"
                  onClick={() => void submitScore(true)}
                  disabled={score < 1}
                >
                  Оноо илгээх
                </button>
              </div>
            </div>
          </div>
        )}

        <GameModePanel
          open={gameModeOpen}
          onClose={closeGameMode}
          playerName={playerName}
          signedIn={clerkSignedIn}
          clerkOn={clerkEnabled}
          mode={mode}
          genre={genre}
          difficulty={difficulty}
          room={party}
          isHost={isPartyHost}
          busy={partyBusy}
          note={partyNote}
          inviteCopied={inviteCopied}
          onPickMode={(_id: GameModeId) => setPartyNote("")}
          onCreateParty={(kind) => void createParty(kind)}
          onJoinParty={(code) => void joinParty(code)}
          onStartParty={() => void startParty()}
          onCopyInvite={() => void copyInvite()}
          onRefresh={() => void refreshParty()}
          onLeave={() => {
            clearRevealUi();
            leaveParty();
          }}
          onLobbySettings={(next) => void updateLobbySettings(next)}
          hotSeatNames={hotSeatNames}
          hotSeatTurn={hotSeatTurn}
          hotSeatScores={hotSeatScores}
          onHotSeatSetup={setupHotSeat}
          onHotSeatExit={exitHotSeat}
        />

        {(settingsOpen || commentsOpen || donateOpen) && (
          <button
            type="button"
            className="fab-backdrop"
            aria-label="Хаах"
            onClick={closeFabPanels}
          />
        )}
        <div className="fab-dock" ref={fabDock}>
          {donateOpen && (
            <DonatePanel open={donateOpen} onClose={closeFabPanels} />
          )}
          {settingsOpen && (
            <div className="settings-pop" role="dialog" aria-label="Тохиргоо">
              <div className="settings-head">
                <strong>Тохиргоо</strong>
                <button
                  type="button"
                  className="board-close"
                  onClick={closeFabPanels}
                  aria-label="Хаах"
                >
                  ×
                </button>
              </div>
              <div className="settings-vols">
                {volCtrl(false, "music")}
                {volCtrl(false, "sfx")}
              </div>
            </div>
          )}
          {commentsOpen && (
            <div className="comments-pop" role="dialog" aria-label="Сэтгэгдэл">
              <div className="settings-head">
                <div>
                  <small>COMMENTS</small>
                  <strong>Сэтгэгдэл</strong>
                </div>
                <button
                  type="button"
                  className="board-close"
                  onClick={closeFabPanels}
                  aria-label="Хаах"
                >
                  ×
                </button>
              </div>
              <div className="comments-list">
                {commentsBusy && comments.length === 0 && (
                  <p className="board-empty">Ачаалж байна…</p>
                )}
                {!commentsBusy && comments.length === 0 && (
                  <p className="board-empty">Анхны сэтгэгдлээ бичээрэй.</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="comment-row">
                    <div className="comment-top">
                      <b>{c.name}</b>
                      <span>{timeAgo(c.at)}</span>
                    </div>
                    <p>{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="comment-compose">
                <textarea
                  value={commentDraft}
                  maxLength={240}
                  rows={2}
                  placeholder={
                    playerName
                      ? `${playerName} та санаа бодлоо бичнэ үү.`
                      : "Сэтгэгдэл…"
                  }
                  onChange={(e) => setCommentDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void postComment();
                    }
                  }}
                />
                <button
                  type="button"
                  className="go"
                  onClick={() => void postComment()}
                  disabled={commentsBusy || commentDraft.trim().length < 2}
                >
                  Илгээх
                </button>
              </div>
              {commentNote && <p className="board-note">{commentNote}</p>}
            </div>
          )}
          <button
            type="button"
            className={`fab donate-fab ${donateOpen ? "on" : ""}`}
            onClick={openDonate}
            title="Дэмжих"
            aria-label="Дэмжих"
          >
            ♥
          </button>
          <button
            type="button"
            className={`fab ${commentsOpen ? "on" : ""}`}
            onClick={openComments}
            title="Сэтгэгдэл"
            aria-label="Сэтгэгдэл"
          >
            💬
          </button>
          <button
            type="button"
            className={`fab ${settingsOpen ? "on" : ""}`}
            onClick={openSettings}
            title="Тохиргоо"
            aria-label="Тохиргоо"
          >
            ⚙
          </button>
        </div>
      </section>
      <audio
        ref={audio}
        crossOrigin="anonymous"
        src={current?.previewUrl}
        preload="auto"
        onEnded={finish}
      />
    </main>
  );
}
