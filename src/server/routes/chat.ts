import type { FastifyInstance } from "fastify";
import type { ChatMessage } from "../../shared/index.ts";
import { askAboutLeague } from "../features/chat.ts";

export function registerChatRoutes(app: FastifyInstance) {
  app.post("/api/chat", async (req, reply) => {
    const { leagueKey, question, history } = req.body as {
      leagueKey?: string | null;
      question?: string;
      history?: ChatMessage[];
    };
    if (!question) return reply.code(400).send({ error: "question is required" });
    try {
      return await askAboutLeague(leagueKey ?? null, question, history ?? []);
    } catch (err) {
      return reply.code(502).send({ error: err instanceof Error ? err.message : "chat failed" });
    }
  });
}
