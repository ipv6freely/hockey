import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useLeague } from "../context/LeagueContext.tsx";
import { QueryBoundary } from "../components.tsx";

export function LeaguePage() {
  const { leagueKey, teams } = useLeague();
  const settingsQuery = useQuery({
    queryKey: ["league", leagueKey],
    queryFn: () => api.league(leagueKey!),
    enabled: !!leagueKey,
  });
  const standingsQuery = useQuery({
    queryKey: ["standings", leagueKey],
    queryFn: () => api.standings(leagueKey!),
    enabled: !!leagueKey,
  });

  if (!leagueKey) return <p className="note">Pick a league on the Connect tab first.</p>;

  return (
    <div className="league-page">
      <section className="panel">
        <h3>Settings</h3>
        <QueryBoundary query={settingsQuery}>
          {(s) => (
            <div>
              <p>
                {s.name} — {s.season} — {s.numTeams} teams — {s.scoringType} scoring — {s.draftType} draft (
                {s.draftStatus})
              </p>
              <p className="note">Roster: {s.rosterPositions.map((r) => `${r.position}×${r.count}`).join(", ") || "—"}</p>
              <p className="note">
                Stat categories: {s.statCategories.map((c) => c.displayName || c.name).join(", ") || "none loaded"}
              </p>
            </div>
          )}
        </QueryBoundary>
      </section>
      <section className="panel">
        <h3>Teams</h3>
        {teams.length === 0 ? (
          <p className="note">No teams loaded yet.</p>
        ) : (
          <ul className="roster-list">
            {teams.map((t) => (
              <li key={t.teamKey}>
                {t.name} {t.isOwnTeam ? "(you)" : ""} {t.managerName ? `— ${t.managerName}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="panel">
        <h3>Standings</h3>
        <QueryBoundary query={standingsQuery}>
          {(rows) =>
            rows.length === 0 ? (
              <p className="note">No standings yet — the season hasn't started.</p>
            ) : (
              <table className="standings-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Team</th>
                    <th>W-L-T</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.teamKey}>
                      <td>{r.rank ?? "—"}</td>
                      <td>{r.teamName}</td>
                      <td>
                        {r.wins}-{r.losses}-{r.ties}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </QueryBoundary>
      </section>
    </div>
  );
}
