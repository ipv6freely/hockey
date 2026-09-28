import type { LeagueSettings, LeagueSummary, RosterPositionSlot, StandingsEntry, StatCategory, TeamSummary } from "../../../shared/index.ts";
import { readThrough } from "../../cache/store.ts";
import { yahooGet } from "./client.ts";
import { asObject, findAll, findFirst, firstString, isTrue } from "./normalize.ts";

function guessStatGroup(name: string): "skater" | "goalie" | "misc" {
  const lower = name.toLowerCase();
  if (["save", "goals against", "shutout", "gaa", "goaltend"].some((h) => lower.includes(h))) return "goalie";
  if (
    ["goal", "assist", "point", "plus/minus", "penalty", "shot", "hit", "faceoff", "power play"].some((h) =>
      lower.includes(h),
    )
  )
    return "skater";
  return "misc";
}

/** All NHL leagues on the connected Yahoo account, across seasons. */
export async function getUserLeagues(): Promise<LeagueSummary[]> {
  const { value } = await readThrough("yahoo", "user-leagues", 2 * 60_000, async () => {
    const raw = await yahooGet("/users;use_login=1/games;game_codes=nhl/leagues");
    const seen = new Set<string>();
    const leagues: LeagueSummary[] = [];
    for (const node of findAll(raw, "league")) {
      const obj = asObject(node);
      const leagueKey = firstString(obj.league_key);
      if (!leagueKey || seen.has(leagueKey)) continue;
      seen.add(leagueKey);
      leagues.push({
        leagueKey,
        leagueId: firstString(obj.league_id) ?? "",
        name: firstString(obj.name) ?? "",
        season: firstString(obj.season) ?? "",
        numTeams: Number(obj.num_teams ?? 0),
        scoringType: firstString(obj.scoring_type) ?? "",
        draftStatus: firstString(obj.draft_status) ?? "",
        isFinished: isTrue(obj.is_finished),
      });
    }
    return leagues;
  });
  return value;
}

export async function getLeagueSettings(leagueKey: string): Promise<LeagueSettings> {
  const { value } = await readThrough("yahoo", `settings-${leagueKey}`, 5 * 60_000, async () => {
    const raw = await yahooGet(`/league/${leagueKey}`, { out: "settings" });
    const leagueMeta = asObject(findFirst(raw, "league"));
    const settings = asObject(findFirst(raw, "settings"));

    const rosterPositions: RosterPositionSlot[] = findAll(settings, "roster_position").map((rp) => {
      const pos = asObject(rp);
      const position = firstString(pos.position) ?? "";
      return {
        position,
        count: Number(pos.count ?? 0),
        isStartingPosition: !["BN", "IR", "IR+", "NA"].includes(position),
      };
    });

    const statCategories: StatCategory[] = findAll(settings, "stat")
      .map((s) => {
        const stat = asObject(s);
        const name = firstString(stat.name) ?? "";
        return {
          statId: Number(stat.stat_id ?? 0),
          name,
          displayName: firstString(stat.display_name) ?? name,
          group: guessStatGroup(name),
          isOnlyDisplayStat: isTrue(stat.is_only_display_stat),
        };
      })
      .filter((s) => s.statId > 0);

    return {
      leagueKey: firstString(leagueMeta.league_key) ?? leagueKey,
      name: firstString(leagueMeta.name) ?? "",
      season: firstString(leagueMeta.season) ?? "",
      numTeams: Number(leagueMeta.num_teams ?? 0),
      scoringType: firstString(leagueMeta.scoring_type) ?? "",
      draftType: firstString(settings.draft_type) ?? "",
      draftStatus: firstString(leagueMeta.draft_status) ?? "",
      draftTime: firstString(settings.draft_time),
      currentWeek: leagueMeta.current_week != null ? Number(leagueMeta.current_week) : null,
      isFinished: isTrue(leagueMeta.is_finished),
      rosterPositions,
      statCategories,
    } satisfies LeagueSettings;
  });
  return value;
}

export async function getTeams(leagueKey: string): Promise<TeamSummary[]> {
  const { value } = await readThrough("yahoo", `teams-${leagueKey}`, 15 * 60_000, async () => {
    const raw = await yahooGet(`/league/${leagueKey}/teams`);
    return findAll(raw, "team").map((node) => {
      const obj = asObject(node);
      const managers = findAll(obj, "manager").map(asObject);
      const isOwnTeam = managers.some((m) => isTrue(m.is_current_login));
      return {
        teamKey: firstString(obj.team_key) ?? "",
        teamId: firstString(obj.team_id) ?? "",
        name: firstString(obj.name) ?? "",
        managerName: firstString(managers[0]?.nickname),
        isOwnTeam,
        logoUrl: firstString(asObject(findFirst(obj, "team_logo")).url),
        draftGrade: firstString(obj.draft_grade),
      } satisfies TeamSummary;
    });
  });
  return value;
}

export async function getStandings(leagueKey: string): Promise<StandingsEntry[]> {
  const { value } = await readThrough("yahoo", `standings-${leagueKey}`, 5 * 60_000, async () => {
    const raw = await yahooGet(`/league/${leagueKey}/standings`);
    return findAll(raw, "team").map((node) => {
      const obj = asObject(node);
      const standings = asObject(findFirst(obj, "team_standings"));
      const outcome = asObject(findFirst(standings, "outcome_totals"));
      return {
        teamKey: firstString(obj.team_key) ?? "",
        teamName: firstString(obj.name) ?? "",
        rank: standings.rank != null ? Number(standings.rank) : null,
        wins: Number(outcome.wins ?? 0),
        losses: Number(outcome.losses ?? 0),
        ties: Number(outcome.ties ?? 0),
        pointsFor: standings.points_for != null ? Number(standings.points_for) : null,
        pointsAgainst: standings.points_against != null ? Number(standings.points_against) : null,
      } satisfies StandingsEntry;
    });
  });
  return value;
}
