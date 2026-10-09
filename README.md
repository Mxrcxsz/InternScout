# Intern Scout

Personal tech-internship aggregator. Scrapes InternSG, LinkedIn (via your own
logged-in session), and open-web career pages once a day, dedupes them, and
serves them through a small dashboard.

## Structure

```
backend/    Node/Express API + scrapers + SQLite storage + daily cron
frontend/   Vue 3 + Vite dashboard
```

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
npm install
```

`better-sqlite3` and `playwright` both need to download native binaries —
this requires normal internet access (it won't work in a sandboxed/offline
environment, but will work fine on your own machine).

After `npm install`, also grab the Playwright browser binary:

```bash
npx playwright install chromium
```

**LinkedIn — one-time manual login** (do this before the first scrape):

```bash
npm run scrape:linkedin:login
```

A real browser window opens. Log in to LinkedIn yourself (handle any
2FA/CAPTCHA manually). Once you're on your feed, come back to the terminal
and press Enter — it saves your session to `linkedin-session.json`. Future
scrapes reuse that file, so your password never touches the code. Keep that
file private (it's in `.gitignore` already) — it's as sensitive as a login
cookie because it *is* one.

> Heads up: automating a logged-in LinkedIn session breaks their Terms of
> Service, even with your own credentials, and their bot detection can
> suspend accounts for it. The scraper paces requests with delays/jitter to
> reduce (not eliminate) that risk. Running it once a day rather than
> constantly is the safer end of the spectrum.

**Career page discovery** needs a free Serper.dev API key (Google search API)
— get one at https://serper.dev and put it in `.env` as `SERPER_API_KEY`.

**Run it:**

```bash
npm start
```

This starts the API on `http://localhost:4000` and schedules a daily scrape
at 08:00 server time. To run a scrape immediately instead of waiting:

```bash
npm run scrape:all
```

Or run individual sources: `npm run scrape:internsg`, `npm run scrape:linkedin`,
`npm run scrape:careers`.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Opens the dashboard at `http://localhost:5173`, pointed at the backend API.

## Deploying

- **Backend**: Render or Railway (needs a persistent process for the cron +
  SQLite file — use a persistent disk/volume, not ephemeral storage).

  backend URL at build time).

## Next: Telegram bot

Once this is running and you're happy with the scrape quality, the natural
next step is a Telegram bot that polls the `/api/jobs` endpoint and pushes
new listings to you — happy to build that next.
