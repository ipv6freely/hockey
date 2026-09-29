import type { DraftSuggestion, ManualLeagueConfig, ManualPick } from "../../shared/index.ts";
import { computeManualDraftClock } from "../../shared/manualDraftClock.ts";
import { config } from "../config.ts";
import { chatComplete } from "../sources/openai/client.ts";
import { getAllPlayers } from "../sources/nhl/client.ts";

/**
 * Same idea as draftAssistant.ts's suggestDraftPick, but sourced entirely
 * from data typed in by hand instead of Yahoo — see AGENTS.md for why this
 * mode exists.
 *
 * Grounded against the real NHL roster list (sources/nhl/client.ts), not
 * just "the model's own knowledge" — an earlier version relied purely on
 * the model's memory and, in real use, recommended already-drafted players
 * and (worse) players who are retired/deceased. Every name in
 * `availableLines` below is confirmed to be an active NHL player as of the
 * roster snapshot, and mechanically excludes anyone already in `picks` —
 * that's a real filter, not a hope that the model reads the drafted list
 * correctly. If the NHL API is unreachable, this degrades to the old
 * knowledge-only behavior with an explicit warning in the prompt rather
 * than failing the whole suggestion — see the try/catch below.
 */
export async function suggestManualPick(
  leagueConfig: ManualLeagueConfig,
  picks: ManualPick[],
  model?: string,
): Promise<DraftSuggestion> {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const myTeam = leagueConfig.teams.find((t) => t.isOwnTeam);
  if (!myTeam) throw new Error("Mark one team as yours in the league setup first");

  const draftedNames = new Set(picks.map((p) => p.playerName.trim().toLowerCase()));
  let availableLines = "";
  try {
    const allPlayers = await getAllPlayers();
    const available = allPlayers.filter((p) => !draftedNames.has(p.name.trim().toLowerCase()));
    availableLines = available.map((p) => `${p.name} (${p.position}, ${p.team})`).join(", ");
  } catch {
    // Handled by the empty-string fallback below.
  }

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

  const system = availableLines
    ? [
        `You are a sharp fantasy hockey draft analyst helping in a live NHL fantasy draft.`,
        `You MUST only recommend players from the AVAILABLE PLAYERS list in the user message — it is the real, current NHL roster list with already-drafted players mechanically removed. Do not recommend anyone not on that list, even if you think of someone else; if a player you'd otherwise suggest isn't listed, they're either already drafted or not on an active NHL roster right now.`,
        `League "${leagueConfig.leagueName || "unnamed"}", ${leagueConfig.teams.length} teams, draft type: ${leagueConfig.draftType}.`,
        `Draft order (round 1): ${leagueConfig.teams.map((t) => t.name).join(", ") || "not specified"}.`,
        `Scoring: ${leagueConfig.scoringNotes || "not specified"}.`,
        `Roster slots: ${leagueConfig.rosterSlots.map((r) => `${r.position}x${r.count}`).join(", ") || "not specified"}.`,
        `Give a concise, opinionated recommendation: 3-5 best players from the available list, ranked, with a one-line reason each grounded in roster need and value, then one sentence of overall strategy for the next couple rounds — use the upcoming pick numbers below if given to reason about how many turns until your next pick and whether to reach or wait on a position. No disclaimers, no hedging preamble.`,
      ].join(" ")
    : [
        `You are a sharp fantasy hockey draft analyst helping in a live NHL fantasy draft.`,
        `WARNING: the live NHL roster list was unreachable for this request, so you have no verified list of active players — you're working from your own training knowledge only, which may be stale or wrong about who is still active. Say so briefly if you're not confident a player is currently active, and never state a player's current-roster status as certain fact.`,
        `This league's data is entered by hand, so also treat anyone listed as drafted below as off the board.`,
        `League "${leagueConfig.leagueName || "unnamed"}", ${leagueConfig.teams.length} teams, draft type: ${leagueConfig.draftType}.`,
        `Draft order (round 1): ${leagueConfig.teams.map((t) => t.name).join(", ") || "not specified"}.`,
        `Scoring: ${leagueConfig.scoringNotes || "not specified"}.`,
        `Roster slots: ${leagueConfig.rosterSlots.map((r) => `${r.position}x${r.count}`).join(", ") || "not specified"}.`,
        `Give a concise, opinionated recommendation: 3-5 best players still plausibly available right now, ranked, with a one-line reason each grounded in roster need and value, then one sentence of overall strategy for the next couple rounds. No disclaimers beyond the roster-confidence caveat above.`,
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
    availableLines && `AVAILABLE PLAYERS (already-drafted players removed):\n${availableLines}`,
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
