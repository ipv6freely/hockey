import type {
  AuthStatus,
  ChatMessage,
  ChatResponse,
  DraftState,
  DraftSuggestion,
  LeagueSettings,
  LeagueSummary,
  PlayerSummary,
  StandingsEntry,
  StatusResponse,
  TeamSummary,
} from "../../src/shared/index";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} -> HTTP ${res.status} ${text}`);
  }
  return (await res.json()) as T;
}

export const api = {
  authStatus: () => getJson<AuthStatus>("/api/auth/status"),
  status: () => getJson<StatusResponse>("/api/status"),
  logout: () => postJson<{ ok: boolean }>("/api/auth/logout", {}),
  leagues: () => getJson<LeagueSummary[]>("/api/leagues"),
  league: (leagueKey: string) => getJson<LeagueSettings>(`/api/league/${leagueKey}`),
  teams: (leagueKey: string) => getJson<TeamSummary[]>(`/api/league/${leagueKey}/teams`),
  standings: (leagueKey: string) => getJson<StandingsEntry[]>(`/api/league/${leagueKey}/standings`),
  roster: (teamKey: string) => getJson<PlayerSummary[]>(`/api/team/${teamKey}/roster`),
  players: (leagueKey: string, params: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) q.set(k, String(v));
    return getJson<PlayerSummary[]>(`/api/league/${leagueKey}/players?${q.toString()}`);
  },
  draft: (leagueKey: string) => getJson<DraftState>(`/api/league/${leagueKey}/draft`),
  suggestPick: (leagueKey: string, teamKey: string) =>
    postJson<DraftSuggestion>(`/api/league/${leagueKey}/draft/suggest`, { teamKey }),
  chat: (leagueKey: string | null, question: string, history: ChatMessage[]) =>
    postJson<ChatResponse>("/api/chat", { leagueKey, question, history }),
};
