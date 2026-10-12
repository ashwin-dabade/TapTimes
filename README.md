# Tap Times

Typing practice with the news. Every night, a job pulls fresh articles, an LLM summarizes each one into plain prose, and users type those summaries while the app tracks WPM, accuracy, and which articles they've already seen.

## Architecture ($0 to run)

```
GitHub Actions (nightly cron)          Vercel (Next.js frontend)
  ingest/ingest.py                        │  anon key + user session
   ├─ Guardian API  → raw articles        ▼
   ├─ Gemini / Groq → summaries      Supabase (Postgres + Auth)
   └─ service-role key ─────────────▶  articles, typing_tests,
                                       user_article_views, users
                                       Row Level Security = access control
```

There is no always-on backend server:
- **Ingest** runs in GitHub Actions on a schedule. It writes with the service-role key.
- **The browser** talks to Supabase directly with the anon key. Row Level Security policies limit each user to their own rows. Articles are public-read.
- **Picking an article** goes through the Postgres function `get_next_article()`, which returns a random article the user hasn't seen yet.

## Repo layout

| Path | What |
|---|---|
| `frontend/` | Next.js 15 app (deployed to Vercel) |
| `ingest/` | Nightly Python job: `sources.py` (news APIs), `summarize.py` (LLM + rate limiting), `db.py` (Supabase REST), `ingest.py` (entry point) |
| `supabase/migrations/` | Database schema, RLS policies, functions. Run in the Supabase SQL Editor |
| `.github/workflows/ingest.yml` | Nightly cron at 06:00 UTC, plus a manual "Run workflow" button |
| `.github/workflows/db-reset.yml` | Manual: delete all articles (asks for confirmation text) |

## Setup

### 1. Supabase
1. If the project was paused for inactivity, restore it from the dashboard.
2. SQL Editor → paste and run `supabase/migrations/001_serverless_schema.sql`. It's safe to re-run, but note that it **replaces all existing RLS policies** on the four app tables.
3. Settings → API: copy the project URL, the `anon` key, and the `service_role` key.

### 2. Frontend (Vercel)
Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel, with the project root set to `frontend/`. For local dev:
```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev
```
In Supabase → Authentication → URL Configuration, add your Vercel URL and `http://localhost:3000` as redirect URLs.

### 3. Nightly ingest (GitHub Actions)
Add these under repo Settings → Secrets and variables → Actions:
- Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GUARDIAN_API_KEY`, `GEMINI_API_KEY` (free at aistudio.google.com), and optionally `GROQ_API_KEY`.
- Variable (optional): `LLM_PROVIDER` = `gemini` (default) or `groq`.

Then go to the Actions tab → "Nightly article ingest" → **Run workflow** to test it. GitHub turns off scheduled workflows after 60 days of repo inactivity. If that happens, re-enable it from the same page.

Local run:
```bash
pip install -r ingest/requirements.txt
cp ingest/.env.example ingest/.env   # fill in values
python ingest/ingest.py
```

## Rate limits
Summaries are made one at a time, at least `LLM_MIN_INTERVAL_SECONDS` apart (default 7s, about 8 per minute). A 429 response is retried with exponential backoff. Articles already in the database are skipped *before* the LLM is called, so re-runs don't use up quota. The default of 10 articles a night is far below free-tier daily limits.

Models are set by env var. `GEMINI_MODEL` defaults to `gemini-flash-lite-latest`, an alias that follows Google's current model. `GROQ_MODEL` defaults to `openai/gpt-oss-20b`. If a provider retires a model, change the variable; no code change is needed.

## Scoring
Users can backspace to fix mistakes, but every wrong keystroke counts against them:
- fixed mistake: −1 point; mistake left unfixed at the end: −2 points
- `accuracy = (characters − penalty) / characters`
- `WPM = (correct characters / 5) / minutes`

The weights are in `frontend/src/lib/scoring.ts`.

## Roadmap
- **Similar-article removal**: enable `pgvector`, have the ingest job store an embedding per article, and skip new articles whose cosine similarity to a recent one passes a threshold.
- **More news sources**: add a `fetch_<source>()` to `ingest/sources.py` and include it in `fetch_all()`.
- **Topics**: articles already store `section`; add a filter parameter to `get_next_article()`.
