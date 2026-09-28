import fs from "node:fs/promises";
import path from "node:path";
import { tokenPath } from "../config.ts";

export interface YahooToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: string; // ISO timestamp
}

export async function loadToken(): Promise<YahooToken | null> {
  try {
    return JSON.parse(await fs.readFile(tokenPath, "utf8")) as YahooToken;
  } catch {
    return null;
  }
}

export async function saveToken(token: YahooToken): Promise<void> {
  await fs.mkdir(path.dirname(tokenPath), { recursive: true });
  const tmp = `${tokenPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(token, null, 2), "utf8");
  await fs.rename(tmp, tokenPath);
}

export async function clearToken(): Promise<void> {
  try {
    await fs.unlink(tokenPath);
  } catch {
    // already gone
  }
}
