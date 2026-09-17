# Дуугаа Таа — Кодын тайлбар

Энэ файл төслийн бүх гол файлуудын зорилго, урсгал, холбоосыг тайлбарлана.

**Live:** https://duu-taaya.vercel.app/  
**Стек:** Next.js 16 · React 19 · TypeScript · Tailwind CSS · Prisma · PostgreSQL (Neon)

---

## 1. Төслийн бүтэц

```
duu-taaya/
├── app/
│   ├── page.tsx                 # Нүүр хуудас
│   ├── layout.tsx               # Root layout, фонт, metadata
│   ├── globals.css              # Бүх UI стиль
│   └── api/
│       ├── comments/route.ts    # Сэтгэгдлийн API
│       ├── leaderboard/route.ts # Leaderboard API
│       └── listen-links/route.ts# Spotify/YouTube шууд линк
├── components/
│   └── song-game.tsx            # Үндсэн тоглоомын UI + логик
├── data/
│   └── catalog.ts               # Дууны сан, жанр, anime map
├── lib/
│   └── prisma.ts                # Prisma client + DB retry
├── prisma/
│   └── schema.prisma            # DB schema
├── generated/prisma/            # Prisma generate-ийн үр дүн (gitignore)
├── public/
│   └── duu-taaya-thumbnail.png  # Төслийн thumbnail
├── .env                         # DATABASE_URL (commit хийхгүй)
├── .env.example
├── package.json
└── README.md
```

---

## 2. App слой

### `app/page.tsx`
- Зөвхөн `SongGame` компонентийг render хийнэ.
- Бүх тоглоом нэг client component дээр төвлөрсөн.

### `app/layout.tsx`
- HTML `lang="mn"`.
- Фонт: **Unbounded** (гарчиг) + **Manrope** (бичвэр).
- Metadata: гарчиг, тайлбар, favicon.

### `app/globals.css`
- CSS хувьсагч: `--bg`, `--accent` (#ff2f55), `--good` гэх мэт.
- Layout: `.shell` (sidebar + stage), `.rail`, `.hud`.
- Тоглоом: wave visualizer, answer box, reveal overlay, fireworks.
- Volume: `.vol-ctrl` (тохиргооны панел дотор).
- Leaderboard / name modal: `.board-overlay`, `.board-card`.
- Баруун доод FAB: `.fab-dock`, `.settings-pop`, `.comments-pop`, `.fab-backdrop`.
- Mobile `@media` дээр volume шууд харагдахгүй, FAB ашиглана.

---

## 3. Дата каталог — `data/catalog.ts`

| Export | Утга |
|--------|------|
| `Genre` | `all`, `new`, `hiphop`, `pop`, `rock`, `traditional`, `anime`, `jpop`, `nineties`, `twoThousands` |
| `Mode` | `mongolian` \| `foreign` |
| `Difficulty` | `easy` \| `medium` \| `hard` \| `expert` |
| `mongolianPools` / `foreignPools` | iTunes **artist ID** жагсаалт (жанраар) |
| `mongolianFeatured` / `foreignFeatured` | Тодорхой **track ID**-ууд |
| `animeSources` | trackId → anime нэр |
| `animeSourcesByTitle` | canonical title → anime |
| `animeRomajiByCanon` | Зөвшөөрөгдөх romaji бичлэгүүд |
| `animeRomajiDisplay` | Харуулах romaji |
| `cuePoints` | Зарим дууны preview эхлэх секунд |
| `difficultyLimits` | Түвшин бүрийн сонсох хугацаа (секунд) |
| `labels` | Жанрын UI нэр |

**Ачаалал:** iTunes Lookup API-аар artist/track ID-аас preview URL авна.

---

## 4. Үндсэн тоглоом — `components/song-game.tsx`

`"use client"` — бүх интерактив логик энд.

### 4.1 Туслах функцууд

| Функц | Зорилго |
|-------|---------|
| `norm` | Текст цэвэрлэх (жижиг үсэг, тэмдэгт хасах) |
| `canonicalTitle` | Remaster/live/remix хасаад харьцуулах нэр гаргах |
| `distance` | Levenshtein зай (ойролцоо таамаг) |
| `titleHits` / `romajiHits` | Хариулт зөв эсэх |
| `guessCorrect` | Сонгосон ID, ижил дуу, title/romaji |
| `animeOf` / `romajiOf` | Anime нэр, romaji олох |
| `resolveListenLinks` | `/api/listen-links`-ээс Spotify/YouTube URL |
| `shuffle` | Crypto random-оор холих |
| `visibleGenres` | Mode-оос хамаарсан жанр шүүлт |
| `mergeBoards` | Local + server leaderboard нэгтгэх |

### 4.2 Тоглоомын урсгал

```
load() → iTunes-ээс дуу татах
  → takeNext() → нэг дуу сонгох
  → play() → preview тоглуулах (хязгаарлагдсан секунд)
  → submit() / Skip
  → reveal() → зөв/буруу + SFX + (зөв бол fireworks)
  → Spotify/YouTube линк
  → 10 дууны дараа leaderboard илгээх
```

### 4.3 Гол state

- `mode`, `genre`, `difficulty` — горим/жанр/түвшин
- `tracks`, `current` — дууны жагсаалт, одоогийн дуу
- `score`, `streak`, `round` — оноо, цуврал, 1–10
- `guess`, `selected` — бичсэн хариулт / suggestion-оос сонгосон
- `revealed`, `revealInfo` — хариу харуулах
- `volume`, `sfxVolume` — дуу / эффект чанга
- `playerName`, `board`, `comments` — нэр, leaderboard, сэтгэгдэл
- `settingsOpen`, `commentsOpen` — FAB панел

### 4.4 Аудио

- `<audio>` + Web Audio API visualizer (частот bar)
- `playSfx("good"|"bad")` — зөв/буруу SFX
- `cuePoints` байвал тэр секундээс эхэлнэ

### 4.5 UI хэсгүүд

1. **Зүүн rail:** difficulty, нэр, reset  
2. **HUD:** Монгол/Гадаад, оноо, 🏆 leaderboard  
3. **Stage:** жанр chip, logo, wave, play, хариултын input  
4. **Reveal overlay:** хариу + listen товчнууд  
5. **FAB (баруун доод):** 💬 сэтгэгдэл, ⚙ тохиргоо (volume)  
6. Гадна дарвал панел хаагдана (`fab-backdrop` + outside click)

### 4.6 LocalStorage түлхүүр

| Түлхүүр | Утга |
|---------|------|
| `duuTaayaName` | Тоглогчийн нэр |
| `duuTaayaSfxVol` | SFX чанга |
| `duuTaayaBoard` | Local leaderboard cache |
| `duuTaayaRecent` | Саяхан тоглосон trackId |

---

## 5. API

### `GET/POST /api/leaderboard`

- **GET:** Top 50 оноо (score ↓, streak ↓)
- **POST:** `{ name, score, streak, mode, difficulty }`
- Ижил нэр (case-insensitive `nameKey`) дээр зөвхөн **илүү өндөр** оноо шинэчлэнэ
- Prisma `LeaderboardScore` model

### `GET/POST /api/comments`

- **GET:** Сүүлийн ~80 сэтгэгдэл
- **POST:** `{ name, body }` (max 16 / 240 тэмдэгт)
- Prisma `Comment` model

### `GET /api/listen-links?title=&artist=`

1. **YouTube:** search HTML-ээс эхний `videoId` → `youtube.com/watch?v=...`
2. **Spotify:** embed token + Web API search → `open.spotify.com/track/...`
3. Амжилтгүй бол search URL-руу унана
4. 6 цагийн memory cache

---

## 6. Database — Prisma

### `prisma/schema.prisma`

```
LeaderboardScore  — id, name, nameKey(unique), score, streak, mode, difficulty, timestamps
Comment           — id, name, body, createdAt
```

### `lib/prisma.ts`

- Singleton `PrismaClient` (`generated/prisma`)
- `db(fn)` — Neon idle timeout үед нэг удаа reconnect + retry

### Команд

```bash
npm run db:generate   # Client generate → generated/prisma
npm run db:push       # Schema → PostgreSQL
npm run db:studio     # GUI
```

Build үед: `prisma generate && next build`  
Postinstall: `prisma generate`

`.env`:

```
DATABASE_URL="postgresql://...?sslmode=require"
```

---

## 7. Онцлог функцууд (товч)

| Онцлог | Хэрхэн |
|--------|--------|
| Монгол / Гадаад | Өөр pool + iTunes country |
| Anime OP | Curated track + romaji/alias matching |
| 90s / 2000s | Artist pool + `releaseDate` жилийн шүүлт |
| Шинэ дуу | 2025-01-01-ээс хойшхи |
| Зөв хариулт | Fuzzy title + romaji + suggestion ID |
| Fireworks | Зөв таахад CSS particle |
| Leaderboard | PostgreSQL + localStorage merge |
| Comments | PostgreSQL, FAB панел |
| Volume | Тохиргоо (⚙) дотор ♪ / SFX |

---

## 8. Гол өгөгдлийн урсгал (диаграм)

```mermaid
flowchart TD
  A[Хэрэглэгч] --> B[SongGame UI]
  B --> C[iTunes Lookup]
  C --> B
  B -->|таах / skip| D[reveal + SFX]
  D --> E[/api/listen-links]
  E --> F[Spotify / YouTube]
  B -->|10 дуу / илгээх| G[/api/leaderboard]
  B -->|сэтгэгдэл| H[/api/comments]
  G --> I[(PostgreSQL)]
  H --> I
```

---

## 9. Ажиллуулах

```bash
npm install
cp .env.example .env   # DATABASE_URL бөглөх
npm run db:push
npm run dev            # http://localhost:3000
```

Vercel: Environment Variables-д `DATABASE_URL` нэмээд deploy.

---

## 10. Файлуудын үүрэг (нэг мөрөөр)

| Файл | Юу хийдэг |
|------|-----------|
| `app/page.tsx` | Нүүр → SongGame |
| `app/layout.tsx` | Layout, фонт, SEO |
| `app/globals.css` | Бүх стиль |
| `components/song-game.tsx` | Тоглоом, UI, audio, FAB |
| `data/catalog.ts` | Дууны ID сан, anime map |
| `lib/prisma.ts` | DB холболт |
| `prisma/schema.prisma` | Хүснэгтийн бүтэц |
| `app/api/leaderboard/route.ts` | Онооны API |
| `app/api/comments/route.ts` | Сэтгэгдлийн API |
| `app/api/listen-links/route.ts` | Listen URL шийдэл |
