import type { PlayerSummary } from "../../../shared/index.ts";
import { readThrough } from "../../cache/store.ts";
import { yahooGet } from "./client.ts";
import { parsePlayers } from "./players.ts";

export async function getRoster(teamKey: string): Promise<PlayerSummary[]> {
  const { value } = await readThrough("yahoo", `roster-${teamKey}`, 60_000, async () => {
    const raw = await yahooGet(`/team/${teamKey}/roster`);
    return parsePlayers(raw);
  });
  return value;
}
