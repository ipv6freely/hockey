import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useLeague } from "../context/LeagueContext.tsx";
import { QueryBoundary } from "../components.tsx";

export function ConnectPage() {
  const queryClient = useQueryClient();
  const authQuery = useQuery({ queryKey: ["authStatus"], queryFn: api.authStatus });
  const statusQuery = useQuery({ queryKey: ["status"], queryFn: api.status });
  const { leagues, leagueKey, setLeagueKey } = useLeague();
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <div className="connect-page">
      <section className="panel">
        <h3>Yahoo account</h3>
        <QueryBoundary query={authQuery}>
          {(auth) =>
            auth.connected ? (
              <div>
                <p className="all-good">
                  Connected. Token valid until{" "}
                  {auth.expiresAt ? new Date(auth.expiresAt).toLocaleString() : "unknown"}.
                </p>
                <button onClick={() => logout.mutate()}>Disconnect</button>
              </div>
            ) : (
              <a className="connect-button" href="/api/auth/yahoo/login">
                Connect Yahoo Account
              </a>
            )
          }
        </QueryBoundary>
      </section>

      <section className="panel">
        <h3>ChatGPT analysis</h3>
        <QueryBoundary query={statusQuery}>
          {(status) =>
            status.openaiConfigured ? (
              <p className="all-good">OPENAI_API_KEY is configured — draft suggestions and chat are enabled.</p>
            ) : (
              <p className="note">Set OPENAI_API_KEY in the server environment to enable draft suggestions and chat.</p>
            )
          }
        </QueryBoundary>
      </section>

      <section className="panel">
        <h3>League</h3>
        {leagues.length === 0 && <p className="note">No NHL leagues found on this Yahoo account yet.</p>}
        {leagues.map((l) => (
          <label key={l.leagueKey} className="league-option">
            <input
              type="radio"
              name="league"
              checked={leagueKey === l.leagueKey}
              onChange={() => setLeagueKey(l.leagueKey)}
            />{" "}
            {l.name} ({l.season}) — {l.draftStatus}
          </label>
        ))}
      </section>
    </div>
  );
}
