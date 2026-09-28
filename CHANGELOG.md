# Changelog

## Unreleased

- **Added Manual Draft mode** (`features/manualDraft.ts`,
  `routes/manualDraft.ts`, `client/src/pages/ManualDraft.tsx`,
  `client/src/hooks/useManualDraft.ts`): type in your league's teams,
  roster slots, and scoring once, log picks as they happen in Yahoo's own
  draft room, and get the same GPT recommendation/chat as the Yahoo-backed
  Draft tab — grounded in hand-typed data instead of a Yahoo lookup. All
  state lives in browser localStorage; the server never persists it. This
  is now the primary path (default tab) given the Yahoo access blocker
  below. The `chat` endpoint gained an optional `manualContext` param so
  the same freeform chat feature serves both modes.
- **Yahoo env vars are no longer required for the server to boot.**
  `YAHOO_CLIENT_ID`/`SECRET`/`REDIRECT_URI` are now optional like
  `OPENAI_API_KEY` — Manual Draft mode needs none of them, so the server
  can't require them just to start. `auth/yahooOAuth.ts`'s
  `requireYahooConfig()` enforces them only at the point something tries
  to actually use Yahoo, with a clean 4xx instead of a crash.
- **Yahoo API access is fully blocked** — every request, down to the most
  basic one possible, returns `403 RBAC: access denied` with a confirmed
  valid token. Recreating the app, adding scope, adding a User-Agent, and
  reconnecting all changed nothing; see AGENTS.md's new "Yahoo API access
  is blocked" section for the full investigation and a documented (not yet
  built) workaround. The Yahoo-backed tabs/routes/parsing all stay in the
  codebase, dormant, rather than removed.
- **Fix:** the Yahoo authorization request never requested the Fantasy
  Sports scope (`scope=fspt-r`). Checking "Fantasy Sports" on the Yahoo app
  only makes that scope available to request — it doesn't get granted
  automatically. Without it, OAuth completed successfully but every actual
  Fantasy Sports API call failed with Yahoo's opaque `RBAC: access denied`.
  Anyone who connected before this fix needs to disconnect and reconnect —
  a refresh token issued without the scope stays scopeless forever.
- All Yahoo API requests now send a `User-Agent` header — Node's default
  `fetch` sends none, and Yahoo's API is known to be stricter about that
  than about the header's actual value.
- Draft tab now auto-fires the GPT recommendation once each time the
  best-effort "on the clock" indicator shows your team, keyed off
  `currentPickNumber` so it can't refire on a polling tick that still shows
  the same pick — only on the next actual turn. The button still works for
  a manual re-run any time.

## 0.1.0 — 2026-09-27

Initial scaffold, built ahead of this league's draft.

- Yahoo OAuth2 connect flow (`/api/auth/yahoo/*`), with on-disk token
  persistence and automatic refresh.
- Yahoo Fantasy Sports API client (`src/server/sources/yahoo/`) covering
  league discovery, league settings/stat categories, teams, standings,
  rosters, player search, and live draft results — plus the normalization
  helpers Yahoo's XML-shaped JSON requires.
- OpenAI-backed draft assistant: one-click GPT recommendation for your next
  pick, grounded in league settings, picks so far, your roster, and top
  available players.
- Freeform GPT chat, grounded in whatever league/draft context is available,
  for ad hoc "analyze this" questions.
- React client: Draft (board + suggestions + chat), Team (roster viewer),
  Players (search/rankings), League (settings/teams/standings), Connect
  (Yahoo OAuth + league picker + OpenAI status).
- `/api/debug/raw` passthrough for inspecting real Yahoo response shapes,
  since normalization was written from docs, not a live league.
- Railway deploy config (`railway.json`), single-service Nixpacks build
  serving the built client from the same Fastify process.

Known gaps going into the draft, tracked in README's "Known limitations":
Yahoo JSON normalization unverified live, "on the clock" is a best-effort
snake-order guess rather than Yahoo-confirmed, no app-level auth.
