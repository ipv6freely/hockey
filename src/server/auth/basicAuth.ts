import type { FastifyInstance } from "fastify";
import { config } from "../config.ts";

/**
 * Whole-app HTTP Basic Auth gate, ported from the same pattern used across
 * other ipv6freely apps (e.g. sbb-bills' Next.js middleware): the browser
 * caches the credentials per-origin after the first prompt, so there's no
 * session/cookie machinery to build or maintain. Registered as the first
 * onRequest hook so it runs before every route, including static assets —
 * there's no unauthenticated path into this app.
 *
 * Fails closed: if AUTH_USERNAME/AUTH_PASSWORD aren't set, every request is
 * rejected rather than silently running unprotected.
 */
export function registerBasicAuth(app: FastifyInstance) {
  app.addHook("onRequest", async (req, reply) => {
    if (!config.authUsername || !config.authPassword) {
      return reply.code(500).send({ error: "AUTH_USERNAME/AUTH_PASSWORD are not configured on this server" });
    }

    const header = req.headers.authorization;
    if (header?.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      const user = decoded.slice(0, sep);
      const pass = decoded.slice(sep + 1);
      if (user === config.authUsername && pass === config.authPassword) {
        return;
      }
    }

    reply.header("WWW-Authenticate", 'Basic realm="puck-advisor"');
    return reply.code(401).send({ error: "Authentication required" });
  });
}
