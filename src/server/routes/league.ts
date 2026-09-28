import type { FastifyInstance } from "fastify";
import { getLeagueSettings, getStandings, getTeams, getUserLeagues } from "../sources/yahoo/league.ts";

export function registerLeagueRoutes(app: FastifyInstance) {
  app.get("/api/leagues", async () => getUserLeagues());

  app.get("/api/league/:leagueKey", async (req) => {
    const { leagueKey } = req.params as { leagueKey: string };
    return getLeagueSettings(leagueKey);
  });

  app.get("/api/league/:leagueKey/teams", async (req) => {
    const { leagueKey } = req.params as { leagueKey: string };
    return getTeams(leagueKey);
  });

  app.get("/api/league/:leagueKey/standings", async (req) => {
    const { leagueKey } = req.params as { leagueKey: string };
    return getStandings(leagueKey);
  });
}
