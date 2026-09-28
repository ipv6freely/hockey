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
not fully consistent.

**Yahoo API access turned out to be blocked entirely — see "Yahoo API
access is blocked" below before touching anything Yahoo-related.** Every
call, including the most basic one possible, returns `403 RBAC: access
denied`, on a freshly created app with the correct scope. This is not a bug
in this codebase (ruled out at length — see that section) and not fixable
by editing `sources/yahoo/*.ts`. The **Manual Draft** tab
(`features/manualDraft.ts`, `routes/manualDraft.ts`,
`client/src/pages/ManualDraft.tsx`) exists specifically to route around
this: same GPT-recommendation/chat idea, fed by hand-typed league
state instead of a Yahoo lookup. It's the primary working path for the
current season. The Yahoo-backed code (Draft, Team, Players, League tabs)
stays in place, dormant, rather than deleted — don't rip it out; either
Yahoo access gets resolved, or the browser-extension workaround described
below gets built, and the Yahoo-backed feature/route/parsing code is what
either path plugs back into.

## Layout and why

```
src/shared/           plain .ts, no package.json — imported by relative path
                       from both server and client (not an npm workspace;
                       see below for why)
src/server/
  config.ts            env var loading — everything is optional (`|| null`),
                       none of it is `required()`; see "Config and secrets"
  auth/                basicAuth.ts (whole-app HTTP Basic Auth gate, the
                       first hook registered) + Yahoo OAuth2 (authorize URL,
                       token exchange/refresh, on-disk token persistence at
                       data/yahoo-token.json)
  sources/yahoo/       Yahoo Fantasy Sports API client + the normalization
                       helpers that untangle its XML-shaped JSON, and one
                       file per resource (league, roster, players, draft) —
                       currently blocked, see above
  sources/openai/      thin wrapper around the Chat Completions endpoint
  features/            draftAssistant.ts + chat.ts (Yahoo-backed, currently
                       blocked), manualDraft.ts (builds the GPT prompt for
                       hand-typed data, the working path), and
                       manualDraftStore.ts (its on-disk persistence at
                       data/manual-draft.json)
  routes/               one file per route group, registered in index.ts
  cache/store.ts        disk-backed read-through cache with stale-on-error
  http/fetchJson.ts    GET/POST with retry+backoff and a per-host concurrency
                       cap; every outbound call (Yahoo, OpenAI) goes through this
client/                self-contained Vite + React app, own package.json —
                       hooks/useManualDraft.ts holds Manual Draft's local
                       state, explicit-Save-synced to the server (see
                       "Manual Draft persistence" below); pages/Settings.tsx
                       (league/teams) and pages/ManualDraft.tsx (draft log)
                       are separate tabs both using this hook
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

## Yahoo API access is blocked

Every request to `fantasysports.yahooapis.com`, including the most basic
one possible (`/users;use_login=1/games`, no filters, no sub-resources),
returns `403` with body `RBAC: access denied`, using a confirmed valid,
non-expired OAuth token. This surfaced first as "no leagues found" on the
Connect tab, then got progressively narrowed down via `/api/debug/raw`.
Ruled out, in order tried, none of which changed the result:

1. Stale/wrong-account token — recreated the Yahoo app from scratch,
   disconnected and reconnected fresh. Same error.
2. Missing `User-Agent` header (Yahoo is known to be picky about this) —
   added one in `sources/yahoo/client.ts`. Same error.
3. Missing OAuth scope — added `scope=fspt-r` to the authorize request in
   `auth/yahooOAuth.ts` (checking "Fantasy Sports" on the app only makes
   the scope *available* to request; the authorize call still has to ask
   for it explicitly, the same way Google/Microsoft OAuth works). This was
   the most promising theory and still didn't change the result.
4. NHL-specific or `/leagues`-specific gating — tested the bare
   `/users;use_login=1/games` call with no game filter at all. Same error.

That last test is the important one: it rules out anything about NHL, the
`/leagues` sub-resource, or this app's specific request shape, and narrows
it to a categorical denial on the account/app combination itself,
independent of anything in this codebase.

**Current best theory**, from a third-party report (not independently
confirmed against Yahoo's own documentation, which doesn't address this):
Yahoo's Fantasy Sports API sits behind an app-review/production-access
gate that self-service app creation through developer.yahoo.com doesn't
actually clear — i.e. there's a real "RBAC" role assignment step for
Fantasy Sports API access that happens outside the app-permissions
checkboxes shown at creation, and a freshly created app simply doesn't
have it yet (possibly ever, without a request Yahoo doesn't expose a clear
self-service path for).

**Documented workaround, not built:** the same third-party report describes
Yahoo's own fantasy web frontend reading from an undocumented, differently-
hosted endpoint — `https://pub-api-ro.fantasysports.yahoo.com/fantasy/v2`
— authenticated by nothing but the browser's ordinary Yahoo session cookie
rather than OAuth, with CORS open to a `fantasysports.yahoo.com` page
origin. Because CORS is enforced by the browser against the *page's*
origin, using this from anywhere other than an actual Yahoo tab requires
either a server-side request carrying that session cookie (which means
capturing the cookie from a real logged-in browser, which no plain webpage
can do — cookies are origin-isolated) or a browser extension with a
content script injected into a `football.fantasysports.yahoo.com` (or
equivalent NHL URL) tab's MAIN world, which inherits that page's origin and
cookies and isn't subject to the extension's own more restrictive CORS.
The proposed shape: a content script that probes
`/users;use_login=1/profile` first (200 here vs. this app's 403 is the
proof the entitlement gate isn't in play on this host — an unauthenticated
request to `pub-api-ro` gets a plain 401, not `RBAC: access denied`), then
walks `/users;use_login=1/games;game_codes=nhl;seasons=${season}/leagues`
and the per-league resources, POSTing only the *fetched results* back to
this app's backend — never the cookie itself, so no Yahoo credential ever
leaves the browser. Explicitly called out as riding on undocumented
internals that Yahoo can change without notice; keep the OAuth path in the
codebase rather than replacing it if this ever gets built.

## Whole-app Basic Auth

`auth/basicAuth.ts` registers an `onRequest` hook — the first thing
registered in `index.ts`, before any route or the static-file handler — that
gates every single request behind HTTP Basic Auth (`AUTH_USERNAME`/
`AUTH_PASSWORD`). Ported from the same pattern used across other ipv6freely
apps (e.g. sbb-bills' Next.js middleware): the browser caches the
credentials per-origin after the first native prompt, so there's no
session/cookie/login-page machinery to build. Plain string comparison, no
`crypto.timingSafeEqual` — matches the source pattern exactly; this is a
single-operator tool, not worth the extra complexity.

Unlike every other config value in this app (Yahoo, OpenAI — see below),
this one **fails closed**: if the env vars aren't set, every request gets a
500, not a degraded-but-working app. An unauthenticated fantasy-draft app
sitting on a public Railway URL is a real exposure; a missing Yahoo/OpenAI
key just means a feature returns an error.

In local dev, only `/api/*` is gated — Vite serves the page itself directly
on :5173, and only proxies `/api/*` through to the Fastify process on :4322
where the hook lives. In production, Fastify serves the static client too,
so the whole thing (including the initial page load) is behind the prompt.
Don't "fix" this dev/prod asymmetry by trying to gate Vite's dev server —
it's expected and harmless (dev is a trusted local machine anyway).

## Manual Draft persistence

`features/manualDraftStore.ts` persists to `data/manual-draft.json` using
the same atomic-write pattern as `auth/tokenStore.ts` (write to a temp file,
`rename` over the real one — avoids a torn/partial file if the process dies
mid-write).

`hooks/useManualDraft.ts` deliberately has **no auto-save/debounce** for
league config: edits only reach the server when the Settings page's Save
button calls `saveConfig()`. An earlier debounced-autosave version of this
hook got replaced after review — silent background saving made it unclear
whether an edit had actually landed, especially once Settings and Manual
Draft became separate tabs/mounts (see below) where switching tabs quickly
after typing could plausibly lose an unsaved debounced write. An explicit
Save button has no such ambiguity. `saveStatus` resets to `"idle"` on every
`setConfig` call specifically so a stale "Saved ✓" can't sit next to an
actually-unsaved edit.

Picks are different: `addPick`/`removeLastPick`/`resetPicks` are already
discrete button-click actions (Log pick / Undo / Reset), not continuous
typing, so they persist immediately — no separate save button for the
draft log, and no risk of losing an in-progress edit since there isn't one.

Settings (`pages/Settings.tsx`) and Manual Draft (`pages/ManualDraft.tsx`)
are separate top-level tabs, each calling `useManualDraft()` independently
— App.tsx's tab switch fully unmounts the inactive page (conditional JSX
rendering, not CSS hiding), so each mount does its own fresh `GET` and
naturally picks up whatever the other tab last saved. There's no shared
React context for this state; the server round-trip on each mount is the
sync mechanism.

Deliberately, `POST /api/manual/draft/suggest` and the manual-mode path of
`POST /api/chat` do **not** read from this store — the client sends its
current in-memory `config`/`picks` directly in the request body instead.
This matters most for picks (which do save immediately, so the store is
usually current) but is also what makes an unsaved Settings edit still work
correctly for a suggestion: a recommendation reflects whatever's currently
on screen even if you haven't clicked Save yet. The store exists purely for
durability (surviving a redeploy, working from a second browser) — reads
for correctness-sensitive requests always come from the caller, never the
store.

## Config and secrets

- Nothing in `config.ts` is `required()` — everything is `|| null` — except
  in spirit `AUTH_USERNAME`/`AUTH_PASSWORD`, which aren't enforced by
  `config.ts` itself but by the fail-closed Basic Auth hook above, which
  runs before anything else. This used to also be true of the three
  `YAHOO_*` vars (they crashed the server at boot if missing, copying the
  sleeper-advisor precedent this app started from), but that broke the
  premise of Manual Draft mode: the server has to boot and serve everything
  except the Yahoo-backed routes with zero Yahoo config present.
  `auth/yahooOAuth.ts`'s `requireYahooConfig()` is the one place that still
  enforces the three Yahoo vars together, and only at the point something
  actually tries to use them (`buildAuthUrl`, `requestToken`) — callers
  (routes) catch and return a 4xx/502, never let it bubble to an unhandled
  crash.
- `OPENAI_API_KEY` follows the same optional-with-graceful-degradation
  pattern: every non-GPT feature keeps working without it, and the GPT
  routes (`draft/suggest`, `manual/draft/suggest`, `chat`) return a clear
  502 with a message instead of crashing the process.
- `isYahooConfigured()` (config.ts) and `isConnected()` (auth/yahooOAuth.ts)
  are two different questions — configured means the three env vars are
  set; connected means a token exists on disk. The Connect tab checks both
  separately (`/api/status`'s `yahooConfigured`, `/api/auth/status`'s
  `connected`) so it can tell "you haven't set up the Yahoo app" apart from
  "you haven't clicked Connect yet."
- `data/yahoo-token.json`, `data/manual-draft.json`, and `data/cache/` are
  all gitignored and all need to survive redeploys on Railway (see README's
  Volume step) — the Yahoo token because losing it means re-doing OAuth,
  the manual draft state because losing it means re-typing your whole
  league setup and draft log, the cache because losing it just means one
  extra round of Yahoo calls (harmless, but no reason to force it).

## Tests

`npm run test` runs Node's built-in test runner over
`src/server/**/*.test.ts`. Currently just `sources/yahoo/normalize.test.ts` —
that module is pure (no network, no fs) and is the highest-risk piece of
logic in the app (see above), so it's the one with the most to gain from
being pinned down by tests. Feature modules that build GPT prompt strings
(`features/draftAssistant.ts`, `features/chat.ts`, `features/manualDraft.ts`)
are deliberately not
unit-tested beyond that — their correctness is "does the prompt read well
and get a useful answer," which is a manual/product judgment call more than
a unit-testable one.
