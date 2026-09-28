import type { ManualLeagueConfig } from "./index.ts";

export interface ManualDraftClock {
  round: number;
  pickNumber: number;
  posInRound: number; // 1-based
  onTheClockTeamName: string;
  totalPicks: number;
  isComplete: boolean;
}

/**
 * Snake-draft "whose turn is it" math. `config.teams`' array order doubles
 * as draft order — there's no separate field for it, see AGENTS.md — so
 * reordering teams in Settings is what changes this. Only meaningful for
 * snake drafts; auction/other draft types have no well-defined turn order,
 * so callers should check `config.draftType` themselves before using this
 * for anything user-facing.
 */
export function computeManualDraftClock(config: ManualLeagueConfig, picksLogged: number): ManualDraftClock | null {
  const nTeams = config.teams.length;
  const totalRosterSlots = config.rosterSlots.reduce((sum, r) => sum + r.count, 0);
  if (nTeams === 0 || totalRosterSlots === 0) return null;

  const totalPicks = nTeams * totalRosterSlots;
  const isComplete = picksLogged >= totalPicks;
  const clamped = Math.min(picksLogged, totalPicks - 1);
  const round = Math.floor(clamped / nTeams) + 1;
  const posInRound = clamped % nTeams;
  const orderThisRound = round % 2 === 1 ? config.teams : [...config.teams].reverse();

  return {
    round,
    pickNumber: picksLogged + 1,
    posInRound: posInRound + 1,
    onTheClockTeamName: isComplete ? "" : orderThisRound[posInRound]?.name ?? "",
    totalPicks,
    isComplete,
  };
}
