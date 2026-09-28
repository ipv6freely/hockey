# Agent notes

Read this before making changes. It covers things that aren't obvious from
the code alone — Yahoo's API quirks especially, since they're the main
source of bugs in this app.

## What this is

A single-league Yahoo NHL fantasy hockey dashboard with a GPT-backed
analyst layered on top. Yahoo's Fantasy Sports API needs OAuth2 (not a
public/keyless API) and returns XML-shaped JSON rather than a clean JSON
API — see "Yahoo API facts" below. NHL scoring is points or head-to-head
categories over goals/assists/saves/etc., not weekly fantasy points from a
fixed formula, so scoring is always read from the league's own settings
rather than assumed.

Read-only against Yahoo by design: this app never submits a draft pick,
waiver claim, or lineup change. It tells you what to do; you click the
buttons in Yahoo's own app or site.

Built before this league's draft happened, which shapes two things: (1) the
Draft tab is the most developed feature, since that's the immediate need;
(2) Yahoo's JSON normalization (see below) has not been checked against a
real, live league response — only against Yahoo's documentation, which is
not fully consistent. Verify it against real data early, via
`/api/debug/raw?path=...`, and fix `sources/yahoo/*.ts` if what you see
doesn't match what's parsed.

## Layout and why

```
src/shared/           plain .ts, no package.json — imported by relative path
                       from both server and client (not an npm workspace;
                       see below for why)
src/server/
  config.ts            env var loading, throws early if required ones are missing
  auth/                Yahoo OAuth2: authorize URL, token exchange/refresh,
                       on-disk token persistence (data/yahoo-token.json)
  sources/yahoo/       Yahoo Fantasy Sports API client + the normalization
                       helpers that untangle its XML-shaped JSON, and one
                       file per resource (league, roster, players, draft)
  sources/openai/      thin wrapper around the Chat Completions endpoint
  features/            draftAssistant.ts (GPT draft-pick recommendation),
                       chat.ts (freeform Q&A) — both build a context string
                       from the yahoo sources, then call sources/openai
  routes/               one file per route group, registered in index.ts
  cache/store.ts        disk-backed read-through cache with stale-on-error
  http/fetchJson.ts    GET/POST with retry+backoff and a per-host concurrency
                       cap; every outbound call (Yahoo, OpenAI) goes through this
client/                self-contained Vite + React app, own package.json
```

Not an npm-workspaces monorepo: Railway's repo scanner auto-splits
workspaces into multiple services, and pre-building a shared package adds a
step for no benefit at this size. `src/shared/*.ts` is imported directly by
relative path from both sides instead.

`src/server/index.ts` serves `client/dist` itself in production (checked via
`existsSync`, so local dev without a client build doesn't break) — one
process, one URL, no CORS.

## Import conventions

- Server-side imports always include the `.ts` extension
  (`allowImportingTsExtensions` + `rewriteRelativeImportExtensions` in
  `tsconfig.json`, so `tsc` rewrites them to `.js` on build, and
  `--experimental-strip-types` in dev runs the `.ts` files directly with no
  transform).
- Client-side imports of `src/shared/*` use extension-less paths
  (`../../src/shared/index`), matching Vite/Bundler resolution — see
  `client/tsconfig.json`'s `moduleResolution: "Bundler"`.
- Every outbound HTTP call (Yahoo, OpenAI, the Yahoo OAuth token endpoint)
  goes through `http/fetchJson.ts`'s `fetchJson`/`postJson`, not raw
  `fetch`, except `auth/yahooOAuth.ts`'s token exchange — that one needs
  form-encoded bodies and Basic auth, which didn't fit the JSON-only
  `postJson` shape cleanly enough to be worth forcing.

## Yahoo API facts that aren't obvious from the docs

- **OAuth2, not a public API key.** Every request needs a bearer token.
  Access tokens are short-lived (~1 hour); `auth/yahooOAuth.ts` refreshes
  automatically when a token is within 2 minutes of expiry, and
  `sources/yahoo/client.ts` additionally retries once on a live 401 in case
  the token expired between that check and Yahoo actually seeing the
  request. The refresh token itself is long-lived and persisted to
  `data/yahoo-token.json` — losing that file means reconnecting via OAuth,
  which is why Railway needs a volume mounted there (see README).

- **`format=json` still returns XML's shape, not a normal JSON API's.**
  Ordered collections come back as `{"0": x, "1": y, count: N}` instead of
  an array, and a single resource (a league, team, or player) is an array of
  small single-key fragments — e.g. a player is
  `[{player_key: "..."}, {name: {full: "..."}}, {editorial_team_abbr: "..."}]`
  — rather than one flat object. The wrapping depth also varies by which
  `out=` params were requested and whether a collection happens to have one
  item or many. `sources/yahoo/normalize.ts`'s `findAll`/`findFirst`
  sidestep this by recursively searching for a named key anywhere in the
  decoded tree instead of assuming a fixed path — more robust to Yahoo's
  inconsistent nesting than modeling every shape exactly, at the cost of
  being unable to distinguish two same-named keys at different semantic
  levels if that ever comes up (it hasn't, in the endpoints this app uses).

- **Draft order is not reliably exposed via the API pre-draft.** `getDraftResults`
  in `sources/yahoo/draft.ts` guesses the live pick order from
  `/league/{key}/teams`' listing order and assumes a standard snake — this
  is flagged in code comments and the README as a best-effort hint, not a
  fact. The actual picks list (`draft_result` resources) IS authoritative
  and updates live as picks happen; don't "fix" the clock guess by trusting
  it over the picks list.

- **Player rosters update live during the draft.** `getPlayers(..., {status:
  "A"})` correctly excludes already-drafted players as the draft
  progresses — Yahoo moves drafted players onto team rosters pick-by-pick,
  not just at draft completion. This is what makes the Draft tab's
  "available players" list usable mid-draft.

- **`sort`/`status`/`position` params on `/league/{key}/players` are passed
  through as-is** in `getPlayers`, not validated or enumerated — Yahoo's own
  documented values are inconsistent across game types and have drifted
  over time. If a param doesn't do what's expected, check
  `/api/debug/raw?path=/league/<key>/players;sort=...` first before assuming
  the parsing is wrong; it might be the param name/value itself.

- **Stat category → skater/goalie grouping is a name-based heuristic**
  (`guessStatGroup` in `sources/yahoo/league.ts`), not derived from a field
  Yahoo provides. If a league has a custom or renamed stat, it may land in
  `misc` incorrectly — harmless (it's only used for display grouping, never
  for scoring math), but worth knowing if a stat looks miscategorized.

## Config and secrets

- `config.ts` throws at import time if `YAHOO_CLIENT_ID`/`YAHOO_CLIENT_SECRET`/
  `YAHOO_REDIRECT_URI` are missing — this only matters when the server
  actually starts (`dev`/`start`), not during `build`/`typecheck`, which
  never import it transitively through a running server.
- `OPENAI_API_KEY` is optional by design (`|| null`, not `required(...)`):
  every non-GPT feature should keep working without it, and the two GPT
  routes (`draft/suggest`, `chat`) return a clear 502 with a message instead
  of crashing the process.
- `data/yahoo-token.json` and `data/cache/` are both gitignored and both
  need to survive redeploys on Railway (see README's Volume step) — the
  token because losing it means re-doing OAuth, the cache because losing it
  just means one extra round of Yahoo calls (harmless, but no reason to
  force it).

## Tests

`npm run test` runs Node's built-in test runner over
`src/server/**/*.test.ts`. Currently just `sources/yahoo/normalize.test.ts` —
that module is pure (no network, no fs) and is the highest-risk piece of
logic in the app (see above), so it's the one with the most to gain from
being pinned down by tests. Feature modules that build GPT prompt strings
(`features/draftAssistant.ts`, `features/chat.ts`) are deliberately not
unit-tested beyond that — their correctness is "does the prompt read well
and get a useful answer," which is a manual/product judgment call more than
a unit-testable one.
