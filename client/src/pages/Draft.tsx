import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useLeague } from "../context/LeagueContext.tsx";
import { ChatBox, QueryBoundary } from "../components.tsx";
import type { PlayerSummary } from "../../../src/shared/index";

function AvailablePlayers({ leagueKey }: { leagueKey: string }) {
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["players", leagueKey, "available", search],
    queryFn: () => api.players(leagueKey, { status: "A", sort: "AR", count: 40, search: search || undefined }),
    refetchInterval: 20_000,
  });

  return (
    <div>
      <input
        className="search-input"
        placeholder="Search available players…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <QueryBoundary query={query}>
        {(players: PlayerSummary[]) => (
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
    </div>
  );
}

export function DraftPage() {
  const { leagueKey, ownTeamKey, teams } = useLeague();
  const draftQuery = useQuery({
    queryKey: ["draft", leagueKey],
    queryFn: () => api.draft(leagueKey!),
    enabled: !!leagueKey,
    refetchInterval: 15_000,
  });
  const suggestMutation = useMutation({
    mutationFn: () => api.suggestPick(leagueKey!, ownTeamKey!),
  });

  // Auto-fire exactly once per turn: keyed off currentPickNumber (which only
  // ever increases) rather than the onTheClockTeamKey flip itself, so a
  // 15s-polling tick that still shows the same pick doesn't refire, but the
  // very next time it's genuinely your turn again (a new, higher pick
  // number) it does.
  const autoSuggestedPickRef = useRef<number | null>(null);
  useEffect(() => {
    autoSuggestedPickRef.current = null;
  }, [leagueKey, ownTeamKey]);

  const draft = draftQuery.data;
  useEffect(() => {
    if (!draft || !ownTeamKey) return;
    if (draft.onTheClockTeamKey !== ownTeamKey) return;
    if (draft.currentPickNumber == null) return;
    if (autoSuggestedPickRef.current === draft.currentPickNumber) return;
    autoSuggestedPickRef.current = draft.currentPickNumber;
    suggestMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.currentPickNumber, draft?.onTheClockTeamKey, ownTeamKey]);

  if (!leagueKey) return <p className="note">Pick a league on the Connect tab first.</p>;

  return (
    <div className="draft-page">
      <section className="panel header-row">
        <QueryBoundary query={draftQuery}>
          {(draft) => (
            <div>
              <h2>Draft status: {draft.draftStatus}</h2>
              {draft.currentPickNumber && (
                <p className="note">
                  Pick #{draft.currentPickNumber} (round {draft.currentRound}) — on the clock:{" "}
                  {teams.find((t) => t.teamKey === draft.onTheClockTeamKey)?.name ?? "unknown (best-effort order)"}
                </p>
              )}
            </div>
          )}
        </QueryBoundary>
      </section>

      <section className="panel">
        <h3>GPT recommendation</h3>
        <button disabled={!ownTeamKey || suggestMutation.isPending} onClick={() => suggestMutation.mutate()}>
          {suggestMutation.isPending ? "Thinking…" : "Get recommendation for my next pick"}
        </button>
        <p className="note">Runs automatically once each time it becomes your turn — use the button to re-run it.</p>
        {!ownTeamKey && <p className="note">Your own team wasn't detected yet — check the League tab once teams load.</p>}
        {suggestMutation.data && <p className="gpt-reply">{suggestMutation.data.reply}</p>}
        {suggestMutation.isError && <p className="state-message error">{String(suggestMutation.error)}</p>}
      </section>

      <section className="panel">
        <h3>Available players</h3>
        <AvailablePlayers leagueKey={leagueKey} />
      </section>

      <section className="panel">
        <h3>Draft board</h3>
        <QueryBoundary query={draftQuery}>
          {(draft) =>
            draft.picks.length === 0 ? (
              <p className="note">No picks yet.</p>
            ) : (
              <ol className="draft-board">
                {draft.picks.map((p) => (
                  <li key={p.pickNumber}>
                    #{p.pickNumber} {teams.find((t) => t.teamKey === p.teamKey)?.name ?? p.teamKey}: {p.playerName}
                  </li>
                ))}
              </ol>
            )
          }
        </QueryBoundary>
      </section>

      <section className="panel">
        <h3>Ask GPT</h3>
        <ChatBox leagueKey={leagueKey} />
      </section>
    </div>
  );
}
