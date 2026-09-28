import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import type { LeagueSummary, TeamSummary } from "../../../src/shared/index";

interface LeagueContextValue {
  leagues: LeagueSummary[];
  leagueKey: string | null;
  setLeagueKey: (key: string) => void;
  teams: TeamSummary[];
  ownTeamKey: string | null;
}

const LeagueContext = createContext<LeagueContextValue | null>(null);

export function LeagueProvider({ children }: { children: ReactNode }) {
  const leaguesQuery = useQuery({ queryKey: ["leagues"], queryFn: api.leagues });
  const [leagueKey, setLeagueKeyState] = useState<string | null>(() => localStorage.getItem("leagueKey"));

  useEffect(() => {
    if (!leagueKey && leaguesQuery.data && leaguesQuery.data.length > 0) {
      setLeagueKeyState(leaguesQuery.data[0].leagueKey);
    }
  }, [leaguesQuery.data, leagueKey]);

  const setLeagueKey = (key: string) => {
    localStorage.setItem("leagueKey", key);
    setLeagueKeyState(key);
  };

  const teamsQuery = useQuery({
    queryKey: ["teams", leagueKey],
    queryFn: () => api.teams(leagueKey!),
    enabled: !!leagueKey,
  });

  const ownTeamKey = useMemo(() => teamsQuery.data?.find((t) => t.isOwnTeam)?.teamKey ?? null, [teamsQuery.data]);

  return (
    <LeagueContext.Provider
      value={{
        leagues: leaguesQuery.data ?? [],
        leagueKey,
        setLeagueKey,
        teams: teamsQuery.data ?? [],
        ownTeamKey,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

export function useLeague(): LeagueContextValue {
  const ctx = useContext(LeagueContext);
  if (!ctx) throw new Error("useLeague must be used within LeagueProvider");
  return ctx;
}
