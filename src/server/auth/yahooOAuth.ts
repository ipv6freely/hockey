import { config } from "../config.ts";
import { loadToken, saveToken, clearToken, type YahooToken } from "./tokenStore.ts";

const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

// In-memory only: this app has one operator, and the state param just needs
// to survive the round trip to Yahoo's consent screen and back. It does not
// need to survive a server restart.
let pendingState: string | null = null;

export function buildAuthUrl(): string {
  pendingState = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: config.yahooClientId,
    redirect_uri: config.yahooRedirectUri,
    response_type: "code",
    state: pendingState,
    language: "en-us",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function verifyState(state: string | undefined): boolean {
  return !!state && !!pendingState && state === pendingState;
}

function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${config.yahooClientId}:${config.yahooClientSecret}`).toString("base64");
}

async function requestToken(body: Record<string, string>): Promise<YahooToken> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuthHeader(),
    },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    throw new Error(`Yahoo token request failed: HTTP ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
  const token: YahooToken = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: new Date(Date.now() + json.expires_in * 1000).toISOString(),
  };
  await saveToken(token);
  return token;
}

export async function exchangeCode(code: string): Promise<YahooToken> {
  pendingState = null;
  return requestToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.yahooRedirectUri,
  });
}

async function refresh(refreshToken: string): Promise<YahooToken> {
  return requestToken({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Returns a valid access token, transparently refreshing when within 2 minutes of expiry. */
export async function getAccessToken(): Promise<string> {
  const token = await loadToken();
  if (!token) throw new Error("Not connected to Yahoo yet — visit /api/auth/yahoo/login first");
  const expiresInMs = Date.parse(token.expiresAt) - Date.now();
  if (expiresInMs > 2 * 60_000) return token.accessToken;
  const refreshed = await refresh(token.refreshToken);
  return refreshed.accessToken;
}

/** Unconditional refresh, used as a one-shot retry when Yahoo rejects a token as expired anyway. */
export async function forceRefresh(): Promise<string> {
  const token = await loadToken();
  if (!token) throw new Error("Not connected to Yahoo yet");
  const refreshed = await refresh(token.refreshToken);
  return refreshed.accessToken;
}

export async function isConnected(): Promise<boolean> {
  return (await loadToken()) !== null;
}

export async function disconnect(): Promise<void> {
  await clearToken();
}

export async function tokenExpiry(): Promise<string | null> {
  const token = await loadToken();
  return token?.expiresAt ?? null;
}
