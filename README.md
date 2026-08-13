# TE4 Tour

Public website for the Mana Games Online Tour: tournaments, draws, results, weekly
rankings with full history, player profiles and head-to-head records.

The data and the rules belong to the Mana Games forum; we only read them and present
them. **The forum itself is off-limits.**

The full project specification is in [CLAUDE.md](CLAUDE.md). Non-obvious design
decisions are recorded in [docs/decisiones.md](docs/decisiones.md). The real structure
of the pages we scrape is documented in [docs/estructura.md](docs/estructura.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Drizzle ORM on Postgres (Neon) ·
Zod · Vitest · Playwright for scraping · ECharts for charts.

## Getting started

You need **Node 20.9 or newer**.

### 1. Install

```bash
git clone https://github.com/franzaragoza1/TennisElbowHubUltimate.git
cd TennisElbowHubUltimate
npm install
```

### 2. Your own database

Everyone uses **their own Neon project**, free of charge. We do not share a database in
development: that way you can break whatever you want without affecting anyone else.

1. Create an account at [neon.tech](https://neon.tech) and a new project (free plan).
2. Copy the connection string it gives you.

> A local Postgres in Docker will not work: [db/client.ts](db/client.ts) uses the
> `@neondatabase/serverless` driver, which speaks Neon's HTTP protocol, not the regular
> Postgres wire protocol.

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` with your Neon connection string. Set `ADMIN_PASSWORD` and
`ADMIN_SECRET` to whatever you like locally. `GROQ_API_KEY` can be left empty (it only
affects the generated head-to-head copy).

The file must be named exactly `.env` — the scripts load it with `--env-file=.env`.

### 4. Create the tables

```bash
npm run db:migrate
```

### 5. Load the data

Your database starts empty. **Do not fill it by scraping** (see below). Ask for the
`data/raw/` zip (about 23 MB), unzip it at the project root and run:

```bash
npm run load
```

That parses the archived HTML and loads it into your database. It takes a while and
leaves a trace in the `import_runs` table.

### 6. Run it

```bash
npm run dev
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generates a migration from changes to `db/schema.ts` |
| `npm run db:migrate` | Applies pending migrations |
| `npm run load` | Parses `data/raw/` and loads it into the database |
| `npm run backfill` | **Scraping owner only.** Downloads HTML from the forum |
| `npm run explore` | One-off reconnaissance of forum pages |

## Scraping has a single owner

`npm run backfill` and `npm run explore` are **not for everyone to run**. Two reasons:

- Access goes through a real Chromium with a persistent profile in `.playwright/`,
  holding the anti-bot challenge cookies. That profile belongs to one specific machine
  and is not in git.
- It is hundreds of requests against someone else's forum, one every 8 seconds. If
  several of us run passes at the same time we get blocked and the project is over.

If you need fresh data, ask for it. Whoever scrapes shares the `data/raw/` zip again and
everyone runs `npm run load`.

## How we work

- `main` is the stable branch and **is connected to Vercel**: anything merged there is
  deployed to production automatically.
- Nobody pushes straight to `main`. One branch per task (`feature/whatever`) and a Pull
  Request.
- Every PR gets its own preview deployment on Vercel; review it there before merging.
- Small, descriptive commits.
- Before a large task, lay out the plan and wait. Do not refactor approved work on your
  own initiative.
- Non-obvious design decisions go in [docs/decisiones.md](docs/decisiones.md) along with
  the reasoning behind them.

## Production

Deployed on Vercel (project `te4-tour`). Production environment variables live in the
Vercel dashboard, **never in the repo**. The production database is a separate Neon
project that only the deployed app connects to.
