import type { FastifyInstance } from "fastify";
import { yahooGet } from "../sources/yahoo/client.ts";

/**
 * Raw passthrough to Yahoo's JSON, for inspecting real response shapes once
 * connected. The normalization in sources/yahoo/*.ts was written from
 * Yahoo's docs, not verified against a live league (this app was built
 * before the season's draft) — use this to check (or fix) normalize.ts
 * against what your league actually returns, e.g.
 * `/api/debug/raw?path=/league/<your-league-key>;out=settings`.
 */
export function registerDebugRoutes(app: FastifyInstance) {
  app.get("/api/debug/raw", async (req, reply) => {
    const { path: resourcePath } = req.query as { path?: string };
    if (!resourcePath) return reply.code(400).send({ error: "?path=/league/... is required" });
    return yahooGet(resourcePath);
  });
}
