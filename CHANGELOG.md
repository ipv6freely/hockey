# Changelog

## Unreleased

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
