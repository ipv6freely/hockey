/**
 * Yahoo's Fantasy Sports API mirrors its native XML shape even in `format=json`
 * mode: ordered collections come back as `{"0": x, "1": y, count: N}` instead
 * of a real array, and a single "resource" (a league, team, or player) is an
 * array of small single-key fragments — e.g. a player is
 * `[{player_key: "..."}, {name: {full: "..."}}, {editorial_team_abbr: "..."}]`
 * — rather than one flat object. The wrapping depth also varies by which
 * `out=` params were requested and whether a collection has one item or many.
 *
 * Rather than modeling every endpoint's exact shape (which drifts across
 * Yahoo's own docs and real responses), these helpers recursively search the
 * decoded JSON for a named key and flatten what they find. That is more
 * robust to Yahoo's inconsistent nesting than a fixed path would be — this
 * was written from Yahoo's docs, not verified against a live league, since
 * this app was built before the season's draft. See routes/debug.ts for a
 * raw passthrough to sanity-check real shapes once connected.
 */

function mergeFragments(fragments: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const frag of fragments) {
    if (Array.isArray(frag)) Object.assign(out, mergeFragments(frag));
    else if (frag && typeof frag === "object") Object.assign(out, frag);
  }
  return out;
}

/** Flattens a Yahoo resource (array-of-fragments, or already a plain object) into one object. */
export function asObject(node: unknown): Record<string, unknown> {
  if (Array.isArray(node)) return mergeFragments(node);
  if (node && typeof node === "object") return node as Record<string, unknown>;
  return {};
}

/** Recursively collects every value found under `key`, at any depth, in any container shape. */
export function findAll(node: unknown, key: string, depth = 10): unknown[] {
  if (depth < 0 || node === null || typeof node !== "object") return [];
  const out: unknown[] = [];
  for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
    if (k === key) out.push(v);
    out.push(...findAll(v, key, depth - 1));
  }
  return out;
}

export function findFirst(node: unknown, key: string, depth = 10): unknown {
  return findAll(node, key, depth)[0];
}

export function firstString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return null;
}

export function isTrue(v: unknown): boolean {
  return v === "1" || v === 1 || v === true;
}
