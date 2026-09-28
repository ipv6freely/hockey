import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useLeague } from "../context/LeagueContext.tsx";
import { QueryBoundary } from "../components.tsx";

export function TeamPage() {
  const { teams, ownTeamKey } = useLeague();
  const [teamKey, setTeamKey] = useState<string | null>(null);

  useEffect(() => {
    if (!teamKey && ownTeamKey) setTeamKey(ownTeamKey);
  }, [ownTeamKey, teamKey]);

  const rosterQuery = useQuery({
    queryKey: ["roster", teamKey],
    queryFn: () => api.roster(teamKey!),
    enabled: !!teamKey,
  });

  return (
    <div className="team-page">
      <section className="panel">
        <select value={teamKey ?? ""} onChange={(e) => setTeamKey(e.target.value)}>
          {teams.length === 0 && <option value="">No teams yet</option>}
          {teams.map((t) => (
            <option key={t.teamKey} value={t.teamKey}>
              {t.name}
              {t.isOwnTeam ? " (you)" : ""}
            </option>
          ))}
        </select>
      </section>
      <section className="panel">
        <h3>Roster</h3>
        {!teamKey ? (
          <p className="note">No teams yet — check back once the draft has run.</p>
        ) : (
          <QueryBoundary query={rosterQuery}>
            {(players) =>
              players.length === 0 ? (
                <p className="note">Empty roster.</p>
              ) : (
                <ul className="roster-list">
                  {players.map((p) => (
                    <li key={p.playerKey}>
                      {p.name} — {p.selectedPosition ?? p.positions.join("/")} — {p.editorialTeamAbbr ?? "—"}
                    </li>
                  ))}
                </ul>
              )
            }
          </QueryBoundary>
        )}
      </section>
    </div>
  );
}
