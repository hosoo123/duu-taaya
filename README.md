# Дуугаа Таа

Next.js, TypeScript, Tailwind CSS дээр хийсэн Монгол болон гадаад дуу таах тоглоом.

## Ажиллуулах

```bash
npm install
cp .env.example .env
# .env дотор DATABASE_URL-ээ Postgres (Neon/Vercel/local)-оор бөглө
npm run db:push
npm run dev
```

### Leaderboard (Prisma + PostgreSQL)

1. [Neon](https://neon.tech) эсвэл Vercel Postgres үүсгэ
2. Connection string-ээ `.env` / Vercel Environment Variables-д `DATABASE_URL` гэж нэм
3. `npm run db:push` (локал) эсвэл deploy үед migrate/push хий

```bash
npm run db:generate   # Prisma Client
npm run db:push       # schema → DB (dev)
npm run db:studio     # DB GUI
```

Монгол/гадаад дууны тусдаа сан, genre ба difficulty шүүлтүүр, leaderboard, Spotify/YouTube линк.

Live: https://duu-taaya.vercel.app/
