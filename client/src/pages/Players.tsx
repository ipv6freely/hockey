import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useLeague } from "../context/LeagueContext.tsx";
import { QueryBoundary } from "../components.tsx";

export function PlayersPage() {
  const { leagueKey } = useLeague();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const query = useQuery({
    queryKey: ["players", leagueKey, status, search],
    queryFn: () => api.players(leagueKey!, { status: status || undefined, sort: "AR", count: 50, search: search || undefined }),
    enabled: !!leagueKey,
  });

  if (!leagueKey) return <p className="note">Pick a league on the Connect tab first.</p>;

  return (
    <div className="players-page">
      <section className="panel">
        <input
          className="search-input"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All players</option>
          <option value="A">Available only</option>
        </select>
        <QueryBoundary query={query}>
          {(players) => (
            <table className="players-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Pos</th>
                  <th>Team</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.playerKey}>
                    <td>{p.name}</td>
                    <td>{p.positions.join("/")}</td>
                    <td>{p.editorialTeamAbbr ?? "—"}</td>
                    <td>{p.status ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
}
