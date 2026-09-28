import type { NhlPlayer } from "../../../shared/index.ts";
import { fetchJson } from "../../http/fetchJson.ts";
import { readThrough } from "../../cache/store.ts";

const BASE = "https://api-web.nhle.com/v1";

/**
 * The NHL's own public stats API — unauthenticated, no API key, unrelated
 * to (and unblocked by) the Yahoo Fantasy Sports API gate in sources/yahoo/.
 * Used only to power the Manual Draft player autocomplete: this is real
 * roster data, not fantasy data, so it doesn't know about fantasy teams,
 * ownership, or rankings.
 */

interface RawStandingsResponse {
  standings: { teamAbbrev: { default: string } }[];
}

async function getActiveTeamTricodes(): Promise<string[]> {
  const { value } = await readThrough("nhl", "teams", 24 * 60 * 60_000, async () => {
    const raw = await fetchJson<RawStandingsResponse>(`${BASE}/standings/now`);
    return raw.standings.map((t) => t.teamAbbrev.default);
  });
  return value;
}

interface RawRosterPlayer {
  id: number;
  firstName: { default: string };
  lastName: { default: string };
  positionCode: string;
}

interface RawRosterResponse {
  forwards: RawRosterPlayer[];
  defensemen: RawRosterPlayer[];
  goalies: RawRosterPlayer[];
}

async function getTeamRoster(tricode: string): Promise<NhlPlayer[]> {
  // 6h, not 24h like the team list: trades/call-ups genuinely happen
  // mid-week, and this endpoint is free/unauthenticated with no reason to
  // be stingy about refreshing it.
  const { value } = await readThrough("nhl", `roster-${tricode}`, 6 * 60 * 60_000, async () => {
    const raw = await fetchJson<RawRosterResponse>(`${BASE}/roster/${tricode}/current`);
    const all = [...raw.forwards, ...raw.defensemen, ...raw.goalies];
    return all.map(
      (p): NhlPlayer => ({
        id: p.id,
        name: `${p.firstName.default} ${p.lastName.default}`,
        team: tricode,
        position: p.positionCode,
      }),
    );
  });
  return value;
}

/**
 * All active NHL players across all 32 teams — roughly 700-800
 * skaters/goalies. Fetched sequentially, not with Promise.all: this API
 * rate-limits (429) a burst of ~32 concurrent requests even well under
 * fetchJson's per-host concurrency cap of 4. Each team is individually
 * cached for 6h (see getTeamRoster), so this only pays the full sequential
 * cost on a cold cache — a warm one is 32 cache hits, effectively instant.
 */
export async function getAllPlayers(): Promise<NhlPlayer[]> {
  const tricodes = await getActiveTeamTricodes();
  const all: NhlPlayer[] = [];
  for (const tricode of tricodes) {
    try {
      all.push(...(await getTeamRoster(tricode)));
    } catch {
      // best-effort: one team's roster failing shouldn't blank the whole list
    }
  }
  return all;
}
