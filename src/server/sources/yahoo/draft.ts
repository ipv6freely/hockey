import type { DraftPick, DraftState } from "../../../shared/index.ts";
import { readThrough } from "../../cache/store.ts";
import { yahooGet } from "./client.ts";
import { asObject, findAll, firstString } from "./normalize.ts";
import { getLeagueSettings, getTeams } from "./league.ts";
import { parsePlayers } from "./players.ts";

async function resolvePlayerNames(playerKeys: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const batchSize = 25;
  for (let i = 0; i < playerKeys.length; i += batchSize) {
    const batch = playerKeys.slice(i, i + batchSize);
    const raw = await yahooGet(`/players;player_keys=${batch.join(",")}`);
    for (const p of parsePlayers(raw)) {
      if (p.playerKey) map.set(p.playerKey, p.name);
    }
  }
  return map;
}

/**
 * Draft picks made so far, plus a best-effort read on whose turn it is.
 * `onTheClockTeamKey` assumes the team listing order from `getTeams` matches
 * the actual live draft order and that the draft is a standard snake — Yahoo
 * doesn't reliably expose the true assigned draft order pre-draft via this
 * API, so treat this as a hint, not a fact. `picks` itself is authoritative:
 * Yahoo updates draft results live as each pick is made.
 */
export async function getDraftResults(leagueKey: string): Promise<DraftState> {
  const { value } = await readThrough("yahoo", `draft-${leagueKey}`, 20_000, async () => {
    const [raw, settings, teams] = await Promise.all([
      yahooGet(`/league/${leagueKey}/draftresults`),
      getLeagueSettings(leagueKey),
      getTeams(leagueKey),
    ]);

    const picks: DraftPick[] = findAll(raw, "draft_result")
      .map(asObject)
      .map((p) => ({
        pickNumber: Number(p.pick ?? 0),
        round: Number(p.round ?? 0),
        teamKey: firstString(p.team_key) ?? "",
        playerKey: firstString(p.player_key),
        playerName: null as string | null,
        cost: p.cost != null ? Number(p.cost) : null,
      }))
      .sort((a, b) => a.pickNumber - b.pickNumber);

    const draftedKeys = picks.map((p) => p.playerKey).filter((k): k is string => !!k);
    const nameByKey = draftedKeys.length ? await resolvePlayerNames(draftedKeys) : new Map<string, string>();
    for (const pick of picks) {
      if (pick.playerKey) pick.playerName = nameByKey.get(pick.playerKey) ?? pick.playerKey;
    }

    const totalRosterSlots = settings.rosterPositions.reduce((sum, r) => sum + r.count, 0);
    const totalPicks = settings.numTeams * totalRosterSlots;
    const draftOrder = teams.map((t) => t.teamKey);
    const nTeams = Math.max(draftOrder.length, 1);
    const nextPickNumber = picks.length + 1;
    const isLive = settings.draftStatus === "draft" || settings.draftStatus === "predraft";

    const round = Math.ceil(nextPickNumber / nTeams);
    const posInRound = nextPickNumber - (round - 1) * nTeams;
    const orderThisRound = settings.draftType === "auction" || round % 2 === 1 ? draftOrder : [...draftOrder].reverse();

    return {
      leagueKey,
      draftStatus: settings.draftStatus,
      draftType: settings.draftType,
      totalPicks,
      picks,
      currentPickNumber: isLive ? nextPickNumber : null,
      currentRound: isLive ? round : null,
      onTheClockTeamKey: settings.draftStatus === "draft" ? orderThisRound[posInRound - 1] ?? null : null,
      draftOrder,
    } satisfies DraftState;
  });
  return value;
}
