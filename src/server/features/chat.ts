import type { ChatMessage, ChatResponse } from "../../shared/index.ts";
import { config } from "../config.ts";
import { chatComplete } from "../sources/openai/client.ts";
import { getLeagueSettings, getTeams } from "../sources/yahoo/league.ts";
import { getDraftResults } from "../sources/yahoo/draft.ts";

async function buildContextBlock(leagueKey: string | null): Promise<string> {
  if (!leagueKey) return "No league is selected yet.";

  const [settings, teams, draft] = await Promise.all([
    getLeagueSettings(leagueKey).catch(() => null),
    getTeams(leagueKey).catch(() => []),
    getDraftResults(leagueKey).catch(() => null),
  ]);

  const draftedPicks = draft?.picks.filter((p) => p.playerName) ?? [];

  return [
    settings &&
      `League "${settings.name}" (${settings.season}), ${settings.numTeams} teams, scoring: ${settings.scoringType}, draft status: ${settings.draftStatus}.`,
    teams.length > 0 && `Teams: ${teams.map((t) => t.name).join(", ")}.`,
    draftedPicks.length > 0 &&
      `Draft picks so far: ${draftedPicks.map((p) => `#${p.pickNumber} ${p.playerName}`).join(", ")}.`,
  ]
    .filter((line): line is string => !!line)
    .join("\n");
}

/**
 * Freeform Q&A grounded in whatever league context is available — used for
 * ad hoc "analyze this" questions outside the structured draft-suggestion
 * flow. `manualContext`, when given, is used verbatim instead of looking
 * anything up from Yahoo — that's how the manual-entry mode (see AGENTS.md)
 * plugs into the same chat endpoint without needing a working Yahoo connection.
 */
export async function askAboutLeague(
  leagueKey: string | null,
  question: string,
  history: ChatMessage[],
  manualContext?: string,
): Promise<ChatResponse> {
  if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not configured");

  const contextBlock = manualContext ?? (await buildContextBlock(leagueKey));
  const system = `You are a knowledgeable fantasy hockey assistant for a Yahoo NHL fantasy league. Use the league context below when relevant, and say when you're missing information rather than guessing. Be direct and concise.\n\n${contextBlock}`;

  const reply = await chatComplete([
    { role: "system", content: system },
    ...history,
    { role: "user", content: question },
  ]);

  return { reply, generatedAt: new Date().toISOString() };
}
