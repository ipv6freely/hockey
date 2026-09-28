import type { FastifyInstance } from "fastify";
import { getPlayers } from "../sources/yahoo/players.ts";

export function registerPlayersRoutes(app: FastifyInstance) {
  app.get("/api/league/:leagueKey/players", async (req) => {
    const { leagueKey } = req.params as { leagueKey: string };
    const q = req.query as Record<string, string>;
    return getPlayers(leagueKey, {
      start: q.start ? Number(q.start) : undefined,
      count: q.count ? Number(q.count) : undefined,
      sort: q.sort,
      status: q.status,
      position: q.position,
      search: q.search,
    });
  });
}
