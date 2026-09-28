import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { config } from "./config.ts";
import { registerBasicAuth } from "./auth/basicAuth.ts";
import { registerAuthRoutes } from "./routes/auth.ts";
import { registerLeagueRoutes } from "./routes/league.ts";
import { registerTeamRoutes } from "./routes/team.ts";
import { registerPlayersRoutes } from "./routes/players.ts";
import { registerDraftRoutes } from "./routes/draft.ts";
import { registerManualDraftRoutes } from "./routes/manualDraft.ts";
import { registerNhlRoutes } from "./routes/nhl.ts";
import { registerChatRoutes } from "./routes/chat.ts";
import { registerStatusRoute } from "./routes/status.ts";
import { registerDebugRoutes } from "./routes/debug.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, "../../client/dist");

const app = Fastify({ logger: true });

registerBasicAuth(app);
registerAuthRoutes(app);
registerLeagueRoutes(app);
registerTeamRoutes(app);
registerPlayersRoutes(app);
registerDraftRoutes(app);
registerManualDraftRoutes(app);
registerNhlRoutes(app);
registerChatRoutes(app);
registerStatusRoute(app);
registerDebugRoutes(app);

// In production this process serves the built client too, so the deployed
// app is a single Railway service on one URL — no CORS, no second service.
// In local dev the client runs under Vite instead (`npm run dev:client`),
// so this is skipped when the client hasn't been built yet.
if (existsSync(clientDist)) {
  await app.register(fastifyStatic, { root: clientDist, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === "GET" && !req.url.startsWith("/api/")) {
      return reply.sendFile("index.html");
    }
    return reply.code(404).send({ error: "not found" });
  });
}

// Railway (and most PaaS hosts) inject PORT and require binding all interfaces,
// not just localhost.
app.listen({ port: config.port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`Puck Advisor server listening at ${address}`);
});
