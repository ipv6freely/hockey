import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

export const config = {
  yahooClientId: required("YAHOO_CLIENT_ID"),
  yahooClientSecret: required("YAHOO_CLIENT_SECRET"),
  yahooRedirectUri: required("YAHOO_REDIRECT_URI"),
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

export const cacheDir = path.join(config.dataDir, "cache");
export const tokenPath = path.join(config.dataDir, "yahoo-token.json");
