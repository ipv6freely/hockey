import type { FastifyInstance } from "fastify";
import { getDraftResults } from "../sources/yahoo/draft.ts";
import { suggestDraftPick } from "../features/draftAssistant.ts";

export function registerDraftRoutes(app: FastifyInstance) {
  app.get("/api/league/:leagueKey/draft", async (req) => {
    const { leagueKey } = req.params as { leagueKey: string };
    return getDraftResults(leagueKey);
  });

  app.post("/api/league/:leagueKey/draft/suggest", async (req, reply) => {
    const { leagueKey } = req.params as { leagueKey: string };
    const { teamKey, model } = req.body as { teamKey?: string; model?: string };
    if (!teamKey) return reply.code(400).send({ error: "teamKey is required" });
    try {
      return await suggestDraftPick(leagueKey, teamKey, model);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "suggestion failed" });
    }
  });
}
