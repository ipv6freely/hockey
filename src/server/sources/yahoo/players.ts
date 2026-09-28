import type { PlayerSummary } from "../../../shared/index.ts";
import { readThrough } from "../../cache/store.ts";
import { yahooGet } from "./client.ts";
import { asObject, findAll, findFirst, firstString } from "./normalize.ts";

/** Parses any Yahoo response containing one or more `player` resources — rosters, search results, and draft-result lookups all share this shape. */
export function parsePlayers(raw: unknown): PlayerSummary[] {
  return findAll(raw, "player").map((node) => {
    const obj = asObject(node);
    const nameObj = asObject(findFirst(obj, "name"));
    const eligiblePositions = findAll(findFirst(obj, "eligible_positions"), "position")
      .map((p) => firstString(p))
      .filter((p): p is string => !!p);
    const selectedNode = findFirst(obj, "selected_position");
    const selectedPosition = selectedNode ? firstString(asObject(selectedNode).position) : null;

    return {
      playerKey: firstString(obj.player_key) ?? "",
      playerId: firstString(obj.player_id) ?? "",
      name: firstString(nameObj.full) ?? "",
      editorialTeamAbbr: firstString(obj.editorial_team_abbr),
      positions: eligiblePositions.length ? eligiblePositions : [firstString(obj.display_position)].filter((p): p is string => !!p),
      selectedPosition,
      status: firstString(obj.status),
      percentOwned: null,
      rank: null,
    } satisfies PlayerSummary;
  });
}

export interface GetPlayersOptions {
  start?: number;
  count?: number;
  /** Yahoo sort keys, e.g. "OR" (overall rank), "AR" (average pick), "PTS", or a stat_id. Passed through as-is. */
  sort?: string;
  /** Yahoo status filter, e.g. "A" (available/free agent+waivers). Omit for all players. */
  status?: string;
  position?: string;
  search?: string;
}

export async function getPlayers(leagueKey: string, opts: GetPlayersOptions = {}): Promise<PlayerSummary[]> {
  const params: Record<string, string | number | undefined> = {
    start: opts.start ?? 0,
    count: opts.count ?? 25,
    sort: opts.sort,
    status: opts.status,
    position: opts.position,
    search: opts.search,
  };
  const cacheKey = `players-${leagueKey}-${JSON.stringify(params)}`;
  // Short TTL: player status/ownership shifts fast during a live draft.
  const { value } = await readThrough("yahoo", cacheKey, 30_000, async () => {
    const raw = await yahooGet(`/league/${leagueKey}/players`, params);
    return parsePlayers(raw);
  });
  return value;
}
