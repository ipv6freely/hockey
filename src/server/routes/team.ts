import type { FastifyInstance } from "fastify";
import { getRoster } from "../sources/yahoo/roster.ts";

export function registerTeamRoutes(app: FastifyInstance) {
  app.get("/api/team/:teamKey/roster", async (req) => {
    const { teamKey } = req.params as { teamKey: string };
    return getRoster(teamKey);
  });
}
