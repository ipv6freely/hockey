import type { DraftSuggestion } from "../../shared/index.ts";
import { config } from "../config.ts";
import { chatComplete } from "../sources/openai/client.ts";
import { getLeagueSettings, getTeams } from "../sources/yahoo/league.ts";
import { getDraftResults } from "../sources/yahoo/draft.ts";
import { getPlayers } from "../sources/yahoo/players.ts";
import { getRoster } from "../sources/yahoo/roster.ts";

export async function suggestDraftPick(leagueKey: string, teamKey: string): Promise<DraftSuggestion> {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const [settings, draft, teams] = await Promise.all([
    getLeagueSettings(leagueKey),
    getDraftResults(leagueKey),
    getTeams(leagueKey),
  ]);
  const [myRoster, available] = await Promise.all([
    getRoster(teamKey).catch(() => []),
    getPlayers(leagueKey, { status: "A", sort: "AR", count: 60 }).catch(() =>
      getPlayers(leagueKey, { status: "A", sort: "OR", count: 60 }),
    ),
  ]);

  const teamNameByKey = new Map(teams.map((t) => [t.teamKey, t.name]));
  const teamName = teamNameByKey.get(teamKey) ?? teamKey;

  const draftedLines = draft.picks
    .filter((p) => p.playerName)
    .map((p) => `Round ${p.round}, Pick ${p.pickNumber}: ${teamNameByKey.get(p.teamKey) ?? p.teamKey} took ${p.playerName}`)
    .join("\n");
  const rosterLine = myRoster.map((p) => `${p.name} (${p.positions.join("/")})`).join(", ") || "empty so far";
  const availableLines = available
    .map((p, i) => `${i + 1}. ${p.name} — ${p.positions.join("/")} — ${p.editorialTeamAbbr ?? "FA"}`)
    .join("\n");

  const system = [
    `You are a sharp fantasy hockey draft analyst helping in a live Yahoo NHL fantasy draft.`,
    `League "${settings.name}" (${settings.season}), ${settings.numTeams} teams, scoring type: ${settings.scoringType}, draft type: ${settings.draftType}.`,
    `Roster slots: ${settings.rosterPositions.map((r) => `${r.position}x${r.count}`).join(", ") || "unknown"}.`,
    `Give a concise, opinionated recommendation: 3-5 best available players for this team right now, ranked, with a one-line reason each grounded in roster need and value, then one sentence of overall strategy for the next couple rounds. No disclaimers, no hedging preamble.`,
  ].join(" ");

  const user = [
    `My team: ${teamName}`,
    `My current roster: ${rosterLine}`,
    ``,
    `Picks so far:`,
    draftedLines || "(draft hasn't started)",
    ``,
    `Top available players:`,
    availableLines || "(none loaded)",
    ``,
    `Who should I take with my next pick, and why?`,
  ].join("\n");

  const reply = await chatComplete([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);

  return { reply, model: config.openaiModel, generatedAt: new Date().toISOString() };
}
