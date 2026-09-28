import type { FastifyInstance } from "fastify";
import type { StatusResponse } from "../../shared/index.ts";
import { isConnected } from "../auth/yahooOAuth.ts";
import { config } from "../config.ts";

export function registerStatusRoute(app: FastifyInstance) {
  app.get("/api/status", async (): Promise<StatusResponse> => {
    return {
      yahooConnected: await isConnected(),
      openaiConfigured: !!config.openaiApiKey,
      defaultLeagueKey: config.defaultLeagueKey,
    };
  });
}
