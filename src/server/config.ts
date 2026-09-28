import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  // Optional, unlike the sleeper-advisor precedent this app started from:
  // the Manual Draft tab (see AGENTS.md on the Yahoo API blocker) needs none
  // of this, so the server has to boot without it. Every Yahoo-backed route
  // returns a clear error instead, same pattern as openaiApiKey below.
  yahooClientId: process.env.YAHOO_CLIENT_ID || null,
  yahooClientSecret: process.env.YAHOO_CLIENT_SECRET || null,
  yahooRedirectUri: process.env.YAHOO_REDIRECT_URI || null,
  // Optional: skips league discovery and pins the app to one league.
  defaultLeagueKey: process.env.YAHOO_LEAGUE_KEY || null,
  // Optional: draft suggestions and chat return a clear error until this is set.
  openaiApiKey: process.env.OPENAI_API_KEY || null,
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  port: Number(process.env.PORT ?? 4322),
  // here = <repoRoot>/src/server (dev, running .ts directly) or
  // <repoRoot>/dist/server (prod, running compiled .js) — same depth either way.
  dataDir: path.resolve(here, "../../data"),
} as const;

export function isYahooConfigured(): boolean {
  return !!(config.yahooClientId && config.yahooClientSecret && config.yahooRedirectUri);
}

export const cacheDir = path.join(config.dataDir, "cache");
export const tokenPath = path.join(config.dataDir, "yahoo-token.json");
