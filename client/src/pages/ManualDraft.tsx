import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useManualDraft } from "../hooks/useManualDraft.ts";
import { ChatBox, ModelPicker, PlayerAutocomplete, useModelPreference, useNhlPlayers } from "../components.tsx";
import { computeManualDraftClock } from "../../../src/shared/manualDraftClock";
import type { ManualLeagueConfig, ManualPick, NhlPlayer } from "../../../src/shared/index";

function buildManualContext(config: ManualLeagueConfig, picks: ManualPick[], nhlPlayers: NhlPlayer[]): string {
  const myTeam = config.teams.find((t) => t.isOwnTeam);
  const clock = config.draftType === "snake" ? computeManualDraftClock(config, picks.length) : null;
  const draftedNames = new Set(picks.map((p) => p.playerName.trim().toLowerCase()));
  const available = nhlPlayers.filter((p) => !draftedNames.has(p.name.trim().toLowerCase()));

  return [
    `League "${config.leagueName || "unnamed"}", ${config.teams.length} teams, draft type: ${config.draftType}.`,
    `Scoring: ${config.scoringNotes || "not specified"}.`,
    `Roster slots: ${config.rosterSlots.map((r) => `${r.position}x${r.count}`).join(", ") || "not specified"}.`,
    config.teams.length > 0 ? `Draft order (round 1): ${config.teams.map((t) => t.name).join(", ")}.` : "",
    myTeam ? `My team: ${myTeam.name}.` : "No team marked as mine yet.",
    clock && !clock.isComplete
      ? `Currently round ${clock.round}, pick ${clock.pickNumber} — ${clock.onTheClockTeamName} on the clock.`
      : "",
    picks.length > 0
      ? `Picks so far: ${picks.map((p) => `#${p.pickNumber} ${p.teamName} - ${p.playerName} (${p.position})`).join("; ")}.`
      : "No picks recorded yet.",
    available.length > 0
      ? `If asked who to draft, only suggest players from this real, current, not-yet-drafted NHL roster list (never suggest a player who isn't on it, even from memory): ${available.map((p) => `${p.name} (${p.position}, ${p.team})`).join(", ")}`
      : "No verified live player list is available right now — if asked who to draft, say you can't confirm a player's current roster status rather than stating it as fact.",
  ]
    .filter(Boolean)
    .join("\n");
}

function DraftLog({
  config,
  picks,
  addPick,
  removeLastPick,
  resetPicks,
  nhlPlayers,
}: {
  config: ManualLeagueConfig;
  picks: ManualPick[];
  addPick: (pick: Omit<ManualPick, "pickNumber">) => void;
  removeLastPick: () => void;
  resetPicks: () => void;
  nhlPlayers: NhlPlayer[];
}) {
  const [teamName, setTeamName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");

  const clock = config.draftType === "snake" ? computeManualDraftClock(config, picks.length) : null;

  // Auto-advance the team dropdown to whoever's on the clock after each
  // pick, so logging a fast-moving live draft doesn't mean re-selecting
  // the same dropdown every single time.
  useEffect(() => {
    if (clock && !clock.isComplete) setTeamName(clock.onTheClockTeamName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock?.onTheClockTeamName, clock?.isComplete]);

  return (
    <section className="panel">
      <h3>Draft log</h3>
      {clock && (
        <p className="clock-banner">
          {clock.isComplete ? (
            "Draft complete!"
          ) : (
            <>
              Round {clock.round}, pick {clock.pickNumber} — <strong>{clock.onTheClockTeamName}</strong> on the
              clock.
            </>
          )}
        </p>
      )}
      {config.teams.length === 0 ? (
        <p className="note">Add teams on the Settings tab before logging picks.</p>
      ) : (
        <div className="form-row">
          <select value={teamName} onChange={(e) => setTeamName(e.target.value)}>
            <option value="">Team…</option>
            {config.teams.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
          <PlayerAutocomplete
            players={nhlPlayers}
            value={playerName}
            onChange={setPlayerName}
            onSelect={(p) => {
              setPlayerName(p.name);
              setPosition(p.position);
            }}
          />
          <input
            className="search-input small"
            placeholder="Pos"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
          <button
            type="button"
            disabled={!teamName || !playerName.trim()}
            onClick={() => {
              addPick({ teamName, playerName: playerName.trim(), position: position.trim() });
              setPlayerName("");
              setPosition("");
            }}
          >
            Log pick
          </button>
        </div>
      )}

      {picks.length === 0 ? (
        <p className="note">No picks logged yet.</p>
      ) : (
        <>
          <ol className="draft-board">
            {picks.map((p) => (
              <li key={p.pickNumber}>
                #{p.pickNumber} {p.teamName}: {p.playerName} ({p.position || "?"})
              </li>
            ))}
          </ol>
          <div className="form-row">
            <button type="button" onClick={removeLastPick}>
              Undo last pick
            </button>
            <button type="button" onClick={() => confirm("Clear the whole draft log?") && resetPicks()}>
              Reset draft
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function ManualDraftPage() {
  const { config, picks, addPick, removeLastPick, resetPicks, loaded } = useManualDraft();
  const [model, setModel] = useModelPreference();
  const nhlPlayersQuery = useNhlPlayers();
  const suggestMutation = useMutation({
    mutationFn: () => api.suggestManualPick(config, picks, model || undefined),
  });
  const myTeam = config.teams.find((t) => t.isOwnTeam);

  if (!loaded) {
    return <p className="state-message">Loading…</p>;
  }

  return (
    <div className="manual-draft-page">
      <section className="panel">
        <p className="note">
          Log picks here as they happen in Yahoo's own draft room — this mode doesn't read or write anything on
          Yahoo, it's a standalone assistant fed by what you type in. Picks save immediately as you log them. Set
          up your league/teams on the Settings tab first.
        </p>
      </section>

      <DraftLog
        config={config}
        picks={picks}
        addPick={addPick}
        removeLastPick={removeLastPick}
        resetPicks={resetPicks}
        nhlPlayers={nhlPlayersQuery.data ?? []}
      />
      {nhlPlayersQuery.isLoading && (
        <p className="note">Loading NHL player list for autocomplete… (can take up to ~30s on a cold cache)</p>
      )}
      {nhlPlayersQuery.isError && (
        <p className="state-message error">
          Player autocomplete failed to load: {String(nhlPlayersQuery.error)} — you can still type names by hand.
        </p>
      )}
      {nhlPlayersQuery.data && (
        <p className="note">{nhlPlayersQuery.data.length} NHL players loaded for autocomplete.</p>
      )}

      <section className="panel">
        <h3>GPT recommendation</h3>
        <ModelPicker value={model} onChange={setModel} />
        <button disabled={!myTeam || suggestMutation.isPending} onClick={() => suggestMutation.mutate()}>
          {suggestMutation.isPending ? "Thinking…" : "Get recommendation for my next pick"}
        </button>
        {!myTeam && <p className="note">Mark your own team on the Settings tab first.</p>}
        {suggestMutation.data && (
          <>
            <p className="gpt-reply">{suggestMutation.data.reply}</p>
            <p className="note">Model: {suggestMutation.data.model}</p>
          </>
        )}
        {suggestMutation.isError && <p className="state-message error">{String(suggestMutation.error)}</p>}
      </section>

      <section className="panel">
        <h3>Ask GPT</h3>
        <ChatBox
          leagueKey={null}
          manualContext={buildManualContext(config, picks, nhlPlayersQuery.data ?? [])}
          model={model}
        />
      </section>
    </div>
  );
}
