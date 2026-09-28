import type { FastifyInstance } from "fastify";
import type { ManualLeagueConfig, ManualPick } from "../../shared/index.ts";
import { suggestManualPick } from "../features/manualDraft.ts";

export function registerManualDraftRoutes(app: FastifyInstance) {
  app.post("/api/manual/draft/suggest", async (req, reply) => {
    const { config: leagueConfig, picks } = req.body as {
      config?: ManualLeagueConfig;
      picks?: ManualPick[];
    };
    if (!leagueConfig) return reply.code(400).send({ error: "config is required" });
    try {
      return await suggestManualPick(leagueConfig, picks ?? []);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "suggestion failed" });
    }
  });
}
