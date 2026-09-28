import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { LeagueProvider } from "./context/LeagueContext.tsx";
import { api } from "./api.ts";
import { ConnectPage } from "./pages/Connect.tsx";
import { ManualDraftPage } from "./pages/ManualDraft.tsx";
import { SettingsPage } from "./pages/Settings.tsx";
import { DraftPage } from "./pages/Draft.tsx";
import { LeaguePage } from "./pages/League.tsx";
import { TeamPage } from "./pages/Team.tsx";
import { PlayersPage } from "./pages/Players.tsx";

const queryClient = new QueryClient();

// "Manual Draft" is the primary, working path for now — see AGENTS.md on
// the Yahoo API access blocker. "Yahoo Draft" and the Yahoo-fed tabs stay
// in place, dormant, for whenever that's resolved.
const TABS = ["Manual Draft", "Settings", "Yahoo Draft", "Team", "Players", "League", "Connect"] as const;
type Tab = (typeof TABS)[number];

function Shell() {
  const [tab, setTab] = useState<Tab>("Manual Draft");
  const authQuery = useQuery({ queryKey: ["authStatus"], queryFn: api.authStatus, refetchInterval: 60_000 });

  return (
    <div className="app">
      <header className="app-header">
        <h1>Puck Advisor</h1>
        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </nav>
        {authQuery.data && !authQuery.data.connected && (
          <p className="note">Not connected to Yahoo yet — open the Connect tab.</p>
        )}
      </header>
      <main className="app-main">
        {tab === "Manual Draft" && <ManualDraftPage />}
        {tab === "Settings" && <SettingsPage />}
        {tab === "Yahoo Draft" && <DraftPage />}
        {tab === "Team" && <TeamPage />}
        {tab === "Players" && <PlayersPage />}
        {tab === "League" && <LeaguePage />}
        {tab === "Connect" && <ConnectPage />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LeagueProvider>
        <Shell />
      </LeagueProvider>
    </QueryClientProvider>
  );
}
