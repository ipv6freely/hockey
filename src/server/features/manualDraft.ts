import type { DraftSuggestion, ManualLeagueConfig, ManualPick } from "../../shared/index.ts";
import { computeManualDraftClock } from "../../shared/manualDraftClock.ts";
import { config } from "../config.ts";
import { chatComplete } from "../sources/openai/client.ts";

/**
 * Same idea as draftAssistant.ts's suggestDraftPick, but sourced entirely
 * from data typed in by hand instead of Yahoo — see AGENTS.md for why this
 * mode exists. There's no live "available players" list here, so the
 * prompt leans on the model's own knowledge of NHL players, guided by
 * which ones are already listed as drafted.
 */
export async function suggestManualPick(
  leagueConfig: ManualLeagueConfig,
  picks: ManualPick[],
  model?: string,
): Promise<DraftSuggestion> {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const myTeam = leagueConfig.teams.find((t) => t.isOwnTeam);
  if (!myTeam) throw new Error("Mark one team as yours in the league setup first");

  const myPicks = picks.filter((p) => p.teamName === myTeam.name);
  const draftedLines = picks
    .map((p) => `Pick ${p.pickNumber}: ${p.teamName} took ${p.playerName} (${p.position})`)
    .join("\n");
  const rosterLine = myPicks.map((p) => `${p.playerName} (${p.position})`).join(", ") || "empty so far";

  const clock = leagueConfig.draftType === "snake" ? computeManualDraftClock(leagueConfig, picks.length) : null;
  let clockLine = "";
  let upcomingPicksLine = "";
  if (clock && !clock.isComplete) {
    clockLine = `Currently round ${clock.round}, pick ${clock.pickNumber} — ${clock.onTheClockTeamName} on the clock.`;
    const myUpcoming: number[] = [];
    for (let n = picks.length; n < clock.totalPicks && myUpcoming.length < 3; n++) {
      const c = computeManualDraftClock(leagueConfig, n);
      if (c && c.onTheClockTeamName === myTeam.name) myUpcoming.push(c.pickNumber);
    }
    if (myUpcoming.length > 0) upcomingPicksLine = `My next few picks land at pick numbers: ${myUpcoming.join(", ")}.`;
  }

  const system = [
    `You are a sharp fantasy hockey draft analyst helping in a live NHL fantasy draft.`,
    `This league's data is entered by hand (no live player database behind this), so use your own knowledge of current NHL players alongside what's given below, and treat anyone listed as drafted as off the board.`,
    `League "${leagueConfig.leagueName || "unnamed"}", ${leagueConfig.teams.length} teams, draft type: ${leagueConfig.draftType}.`,
    `Draft order (round 1): ${leagueConfig.teams.map((t) => t.name).join(", ") || "not specified"}.`,
    `Scoring: ${leagueConfig.scoringNotes || "not specified"}.`,
    `Roster slots: ${leagueConfig.rosterSlots.map((r) => `${r.position}x${r.count}`).join(", ") || "not specified"}.`,
    `Give a concise, opinionated recommendation: 3-5 best players still plausibly available right now, ranked, with a one-line reason each grounded in roster need and value, then one sentence of overall strategy for the next couple rounds — use the upcoming pick numbers below if given to reason about how many turns until your next pick and whether to reach or wait on a position. No disclaimers, no hedging preamble.`,
  ].join(" ");

  const user = [
    `My team: ${myTeam.name}`,
    `My current roster: ${rosterLine}`,
    clockLine,
    upcomingPicksLine,
    ``,
    `Picks so far (${picks.length} total):`,
    draftedLines || "(draft hasn't started)",
    ``,
    `Who should I take with my next pick, and why?`,
  ]
    .filter(Boolean)
    .join("\n");

  const reply = await chatComplete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { model },
  );

  return { reply, model: model ?? config.openaiModel, generatedAt: new Date().toISOString() };
}
