import type { FastifyInstance } from "fastify";
import type { ManualDraftState, ManualLeagueConfig, ManualPick } from "../../shared/index.ts";
import { suggestManualPick } from "../features/manualDraft.ts";
import { loadManualDraftState, saveManualDraftState } from "../features/manualDraftStore.ts";

export function registerManualDraftRoutes(app: FastifyInstance) {
  // Suggest/chat take config+picks directly in the request body rather than
  // reading the persisted state below, so a recommendation always reflects
  // whatever's currently in the browser even if unsaved league-setup edits
  // haven't been persisted yet (see client/src/hooks/useManualDraft.ts —
  // config edits require an explicit Save).
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

  // Persisted to data/manual-draft.json (on the Railway volume in
  // production) so the league setup and draft log survive redeploys and a
  // cleared browser, instead of living only in localStorage.
  app.get("/api/manual/draft/state", async (): Promise<ManualDraftState> => {
    return loadManualDraftState();
  });

  app.put("/api/manual/draft/state", async (req, reply) => {
    const state = req.body as ManualDraftState | undefined;
    if (!state?.config || !Array.isArray(state.picks)) {
      return reply.code(400).send({ error: "config and picks are required" });
    }
    await saveManualDraftState(state);
    return { ok: true };
  });
}
