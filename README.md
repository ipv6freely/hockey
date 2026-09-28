# Puck Advisor

A dashboard for one Yahoo NHL fantasy hockey league: read-only against the
league API, with a ChatGPT-backed analyst on top for the stuff no structured
API can tell you — including live help during the draft itself.

**Right now, Yahoo's Fantasy Sports API is rejecting every request from this
app with `RBAC: access denied`, on a freshly created app, with the correct
scope requested — see "Yahoo API access is currently blocked" under Known
limitations before spending time on OAuth setup.** The **Manual Draft** tab
works standalone without any Yahoo connection and is the primary supported
path until that's resolved.

## What it does

- **Settings** — set up your league once: name, scoring notes, roster
  slots, and teams (mark which one is yours). Has its own Save button —
  edits here aren't persisted until you click it.
- **Manual Draft** — the currently-working draft-day path: log each pick as
  it happens in Yahoo's own draft room (saves immediately, no separate save
  step), then get a one-click GPT recommendation for your next pick and a
  freeform chat box, both grounded in your league setup and the picks so
  far (there's no live player database behind this mode — the model uses
  its own knowledge of NHL players). All of it saved server-side
  (`data/manual-draft.json`, on the same volume as the Yahoo token — see
  Deploying below), so it survives a redeploy and isn't tied to one
  browser.
- **Yahoo Draft** — the Yahoo-API-backed version of the above: a live draft
  board (picks pulled straight from Yahoo as they happen), available
  players, and the same GPT recommendation/chat, grounded in real Yahoo
  data instead of typed-in data. Currently non-functional — see above.
- **Team** — roster viewer for any team in the league, defaulting to yours.
  (Yahoo-backed; same blocker.)
- **Players** — general player search/rankings tool, useful post-draft for
  waivers too. (Yahoo-backed; same blocker.)
- **League** — settings (scoring type, roster slots, stat categories),
  team list, and standings once the season starts. (Yahoo-backed; same
  blocker.)
- **Connect** — Yahoo OAuth connect/disconnect, league picker, and a check
  that `OPENAI_API_KEY` is configured.

Yahoo's Fantasy Sports API is read-only from this app's side by choice: it
tells you what to do, you click the buttons in the Yahoo app yourself. It
never submits a pick, claim, or lineup change.

The whole app sits behind HTTP Basic Auth (`AUTH_USERNAME`/`AUTH_PASSWORD`)
— your browser prompts once and caches the credentials, no separate login
page or session cookie involved. Same mechanism used across other
ipv6freely apps.

## Project layout

Not an npm-workspaces monorepo — Railway's repo scanner auto-splits those
into multiple services.

```
src/shared/   plain .ts files (types only), no package.json,
              imported by relative path from both server and client
src/server/   Fastify API — auth/ (Basic Auth gate + Yahoo OAuth2),
              sources/yahoo/ (API client + normalization), sources/openai/,
              features/ (draft assistant, chat, manual draft + its storage),
              routes/
client/       self-contained Vite + React app with its OWN package.json —
              built independently via `cd client && npm run build`
```

`src/server/index.ts` serves the built `client/dist` as static files itself,
so the deployed app is one process on one URL.

## Setup

Only `AUTH_USERNAME`/`AUTH_PASSWORD` (step 1) and `OPENAI_API_KEY` (step 2)
matter for the currently-working Manual Draft path — skip straight to those
if you're not chasing the Yahoo blocker above.

### 1. Pick a username and password

Any values — these gate the whole app behind HTTP Basic Auth (see above),
they're not tied to any external account. `AUTH_USERNAME`/`AUTH_PASSWORD`
below. The server refuses every request with a 500 until both are set, so
this isn't optional the way the Yahoo/OpenAI vars are.

### 2. Register a Yahoo app

Create an app at <https://developer.yahoo.com/apps/> with **Fantasy Sports**
read permission. Set its redirect URI to match `YAHOO_REDIRECT_URI` below
exactly (Yahoo checks this byte-for-byte) — for local dev that's
`http://localhost:4322/api/auth/yahoo/callback`; for Railway it's your
deployed URL with the same path (see Deploying, below — you'll need to
deploy once to get that URL before this redirect URI can be finalized).

### 3. Get an OpenAI API key

Create a key at <https://platform.openai.com/api-keys>. This is what "using
my ChatGPT account" means technically: the app calls the OpenAI API with
your key, not the consumer chatgpt.com session.

### 4. Configure and install

```
npm install
cp .env.example .env   # then fill in real values
```

`AUTH_USERNAME`/`AUTH_PASSWORD` are the only vars that must be set for the
server to do anything at all (it fails closed with a 500 otherwise — see
above). `PORT` defaults to 4322. Everything else is optional, each
degrading to a clear error on the specific features that need it rather
than blocking the whole app (see `.env.example`):

- `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI` — needed for
  the Connect tab / Yahoo Draft tab. Not needed for Manual Draft. Given the
  current blocker above, you may not need these at all right now.
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

Open <http://localhost:5173>. The first `/api/*` call will trigger your
browser's native Basic Auth prompt — enter `AUTH_USERNAME`/`AUTH_PASSWORD`
from your `.env`. (In dev, only `/api/*` is gated, since Vite serves the
page itself on :5173 directly; in production Fastify serves everything, so
the whole app — including the page load — is behind the prompt.) Then use
the Connect tab to link your Yahoo account, or just use Manual Draft.

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
2. Add `AUTH_USERNAME`, `AUTH_PASSWORD` (required — the app returns 500 for
   everything without these), and optionally `YAHOO_CLIENT_ID`,
   `YAHOO_CLIENT_SECRET`, `YAHOO_REDIRECT_URI` (your Railway URL +
   `/api/auth/yahoo/callback`), `OPENAI_API_KEY`, `YAHOO_LEAGUE_KEY` /
   `OPENAI_MODEL` in the service's **Variables** tab. Don't set `PORT` —
   Railway injects it.
3. Add a **Volume** mounted at `/app/data`. Without one, the Manual Draft
   state (`data/manual-draft.json`), the Yahoo OAuth token
   (`data/yahoo-token.json`), and the disk cache under `data/cache/` are
   all ephemeral — you'd lose your draft log/roster and have to reconnect
   Yahoo on every redeploy.
4. If using Yahoo, update the Yahoo app's registered redirect URI to match
   step 2's value. Deploy.

## Known limitations

- **Yahoo API access is currently blocked.** Every call to
  `fantasysports.yahooapis.com` — even the most basic one,
  `/users;use_login=1/games`, with no filters at all — returns
  `403 RBAC: access denied`, with a valid, non-expired OAuth token. Ruled
  out so far, none of which changed the result: recreating the Yahoo app
  from scratch, adding `scope=fspt-r` to the authorize request, adding a
  `User-Agent` header, disconnecting/reconnecting. This is not specific to
  NHL, to the `/leagues` sub-resource, or to this app's OAuth config — it's
  a categorical denial on the account/app combination itself, which points
  to Yahoo's app-review/production-access gate rather than anything fixable
  from this codebase. The **Manual Draft** tab exists specifically to route
  around this for the current season; see AGENTS.md for the full
  investigation and a documented (but not yet built) workaround using
  Yahoo's undocumented `pub-api-ro.fantasysports.yahoo.com` frontend host,
  if Yahoo access remains blocked and is worth revisiting later.
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
- **Basic Auth is one shared username/password for the whole app**, not
  per-user accounts — fine for a single-operator tool, but don't reuse a
  meaningful password here, and note that anyone you share those
  credentials with can trigger GPT calls billed to your OpenAI key.
- **Draft-turn suggestions cap available players at 60** (by average pick)
  to keep the GPT prompt a reasonable size — deep-bench/streaming
  candidates beyond that won't be considered, only the players visible on
  the Draft tab's own list (which you can search).
