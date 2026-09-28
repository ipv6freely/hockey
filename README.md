# Puck Advisor

A dashboard for one Yahoo NHL fantasy hockey league: read-only against the
league API, with a ChatGPT-backed analyst on top for the stuff no structured
API can tell you — including live help during the draft itself.

## What it does

- **Draft** — the centerpiece, since this league hasn't drafted yet: a live
  draft board (picks so far, pulled straight from Yahoo as they happen),
  available players, a one-click GPT recommendation for your next pick
  (grounded in your roster, the picks so far, and league scoring/roster
  settings), and a freeform chat box for ad hoc questions mid-draft.
- **Team** — roster viewer for any team in the league, defaulting to yours.
- **Players** — general player search/rankings tool, useful post-draft for
  waivers too.
- **League** — settings (scoring type, roster slots, stat categories),
  team list, and standings once the season starts.
- **Connect** — Yahoo OAuth connect/disconnect, league picker, and a check
  that `OPENAI_API_KEY` is configured.

Yahoo's Fantasy Sports API is read-only from this app's side by choice: it
tells you what to do, you click the buttons in the Yahoo app yourself. It
never submits a pick, claim, or lineup change.

## Project layout

Not an npm-workspaces monorepo — Railway's repo scanner auto-splits those
into multiple services.

```
src/shared/   plain .ts files (types only), no package.json,
              imported by relative path from both server and client
src/server/   Fastify API — auth/ (Yahoo OAuth2), sources/yahoo/ (API client
              + normalization), sources/openai/, features/ (draft assistant,
              chat), routes/
client/       self-contained Vite + React app with its OWN package.json —
              built independently via `cd client && npm run build`
```

`src/server/index.ts` serves the built `client/dist` as static files itself,
so the deployed app is one process on one URL.

## Setup

### 1. Register a Yahoo app

Create an app at <https://developer.yahoo.com/apps/> with **Fantasy Sports**
read permission. Set its redirect URI to match `YAHOO_REDIRECT_URI` below
exactly (Yahoo checks this byte-for-byte) — for local dev that's
`http://localhost:4322/api/auth/yahoo/callback`; for Railway it's your
deployed URL with the same path (see Deploying, below — you'll need to
deploy once to get that URL before this redirect URI can be finalized).

### 2. Get an OpenAI API key

Create a key at <https://platform.openai.com/api-keys>. This is what "using
my ChatGPT account" means technically: the app calls the OpenAI API with
your key, not the consumer chatgpt.com session.

### 3. Configure and install

```
npm install
cp .env.example .env   # then fill in real values
```

Required env vars (see `.env.example`):

- `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET` — from the Yahoo app above
- `YAHOO_REDIRECT_URI` — must exactly match the app's registered redirect URI
- `PORT` — defaults to 4322 locally; Railway injects its own and this is
  ignored there

Optional:

- `YAHOO_LEAGUE_KEY` — pins the app to one league, skipping discovery. Find
  it in your league's Yahoo URL, or via the Connect tab's league picker once
  connected without it set.
- `OPENAI_API_KEY` — without this, everything except GPT draft suggestions
  and chat works; those two return a clear error instead of crashing.
- `OPENAI_MODEL` — defaults to `gpt-4o-mini`. Set to whichever current model
  you want.

## Running locally

Two terminals:

```
npm run dev          # Fastify API on :4322, raw TS via Node's native stripping
npm run dev:client    # Vite dev server on :5173, proxies /api to :4322
```

Open <http://localhost:5173>, then use the Connect tab to link your Yahoo
account.

## Building / running for production

```
npm run build   # tsc for src/, then cd client && npm install && npm run build
npm run start   # node dist/server/index.js — serves the API and client/dist together
```

## Tests

```
npm run test    # node's built-in test runner, src/server/**/*.test.ts
```

## Deploying to Railway

`railway.json` at the repo root configures a single Nixpacks service:
`npm run build` to build, `node dist/server/index.js` to run.

1. Deploy from this GitHub repo. If Railway offers to create more than one
   service (it may still try, based on framework detection in `client/`),
   keep only one and set its **Root Directory** to the repo root — not
   `client` or any subfolder.
2. Add `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI` (your
   Railway URL + `/api/auth/yahoo/callback`), `OPENAI_API_KEY`, and
   optionally `YAHOO_LEAGUE_KEY` / `OPENAI_MODEL` in the service's
   **Variables** tab. Don't set `PORT` — Railway injects it.
3. Add a **Volume** mounted at `/app/data`. Without one, the Yahoo OAuth
   token (`data/yahoo-token.json`) and the disk cache under `data/cache/`
   are ephemeral — you'd have to reconnect Yahoo on every redeploy.
4. Update the Yahoo app's registered redirect URI to match step 2's value,
   then deploy.

## Known limitations

- **Yahoo's JSON normalization is unverified against a live league.** This
  app was built before this league's draft, so `src/server/sources/yahoo/*.ts`
  was written from Yahoo's docs (which are inconsistent about response
  shape), not checked against real responses. `normalize.ts`'s `findAll` /
  `findFirst` recursively search the decoded JSON for named keys rather than
  assuming a fixed path, which should absorb most of Yahoo's inconsistent
  nesting — but if something looks wrong once you're connected, hit
  `/api/debug/raw?path=/league/<your-league-key>;out=settings` (or any other
  resource path) to see the real shape and adjust the relevant parser.
- **"On the clock" during the draft is a best-effort guess**, not a fact:
  it assumes the team listing order from `/league/{key}/teams` matches the
  actual live pick order and that the draft is a standard snake. The picks
  list itself is authoritative (Yahoo updates it live as picks happen) — the
  clock indicator is just a hint for who's likely up next.
- **No app-level login wall**: anyone with the deployed URL can view league
  data and trigger GPT calls billed to your OpenAI key. Fine for a
  single-user tool on a private Railway URL; don't share the link if that's
  a concern.
- **Draft-turn suggestions cap available players at 60** (by average pick)
  to keep the GPT prompt a reasonable size — deep-bench/streaming
  candidates beyond that won't be considered, only the players visible on
  the Draft tab's own list (which you can search).
