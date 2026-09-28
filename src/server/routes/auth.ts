import type { FastifyInstance } from "fastify";
import type { AuthStatus } from "../../shared/index.ts";
import { buildAuthUrl, disconnect, exchangeCode, isConnected, tokenExpiry, verifyState } from "../auth/yahooOAuth.ts";

export function registerAuthRoutes(app: FastifyInstance) {
  app.get("/api/auth/yahoo/login", async (_req, reply) => {
    try {
      reply.redirect(buildAuthUrl());
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Yahoo isn't configured" });
    }
  });

  app.get("/api/auth/yahoo/callback", async (req, reply) => {
    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !verifyState(state)) {
      return reply.code(400).send({ error: "Invalid or expired OAuth callback — try connecting again" });
    }
    try {
      await exchangeCode(code);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "Yahoo token exchange failed" });
    }
    reply.redirect("/");
  });

  app.get("/api/auth/status", async (): Promise<AuthStatus> => {
    return { connected: await isConnected(), expiresAt: await tokenExpiry() };
  });

  app.post("/api/auth/logout", async () => {
    await disconnect();
    return { ok: true };
  });
}
