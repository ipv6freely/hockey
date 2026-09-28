import type { FastifyInstance } from "fastify";
import { getAllPlayers } from "../sources/nhl/client.ts";

export function registerNhlRoutes(app: FastifyInstance) {
  // Real NHL rosters, not fantasy data — powers the Manual Draft player
  // autocomplete. Independent of Yahoo/OpenAI config; always available.
  app.get("/api/nhl/players", async () => getAllPlayers());
}
