import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api.ts";
import { useManualDraft } from "../hooks/useManualDraft.ts";
import { ChatBox } from "../components.tsx";
import type { ManualLeagueConfig, ManualPick } from "../../../src/shared/index";

type SetConfig = (config: ManualLeagueConfig) => void;

function buildManualContext(config: ManualLeagueConfig, picks: ManualPick[]): string {
  const myTeam = config.teams.find((t) => t.isOwnTeam);
  return [
    `League "${config.leagueName || "unnamed"}", ${config.teams.length} teams, draft type: ${config.draftType}.`,
    `Scoring: ${config.scoringNotes || "not specified"}.`,
    `Roster slots: ${config.rosterSlots.map((r) => `${r.position}x${r.count}`).join(", ") || "not specified"}.`,
    myTeam ? `My team: ${myTeam.name}.` : "No team marked as mine yet.",
    picks.length > 0
      ? `Picks so far: ${picks.map((p) => `#${p.pickNumber} ${p.teamName} - ${p.playerName} (${p.position})`).join("; ")}.`
      : "No picks recorded yet.",
  ].join("\n");
}

function LeagueSetup({ config, setConfig }: { config: ManualLeagueConfig; setConfig: SetConfig }) {
  const [newSlotPosition, setNewSlotPosition] = useState("");
  const [newSlotCount, setNewSlotCount] = useState("1");
  const [newTeamName, setNewTeamName] = useState("");

  return (
    <section className="panel">
      <h3>League setup</h3>
      <div className="form-row">
        <input
          className="search-input"
          placeholder="League name"
          value={config.leagueName}
          onChange={(e) => setConfig({ ...config, leagueName: e.target.value })}
        />
        <select
          value={config.draftType}
          onChange={(e) => setConfig({ ...config, draftType: e.target.value as ManualLeagueConfig["draftType"] })}
        >
          <option value="snake">Snake</option>
          <option value="auction">Auction</option>
          <option value="other">Other</option>
        </select>
      </div>
      <textarea
        className="search-input textarea"
        placeholder="Scoring notes, e.g. Categories: G, A, +/-, PIM, SOG, HIT, FOW, PPP. Goalies: W, GAA, SV%, SHO."
        value={config.scoringNotes}
        onChange={(e) => setConfig({ ...config, scoringNotes: e.target.value })}
      />

      <h4>Roster slots</h4>
      <ul className="editable-list">
        {config.rosterSlots.map((slot, i) => (
          <li key={i}>
            {slot.position} × {slot.count}{" "}
            <button
              type="button"
              onClick={() => setConfig({ ...config, rosterSlots: config.rosterSlots.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="form-row">
        <input
          className="search-input small"
          placeholder="Position (C, LW, D, G, BN…)"
          value={newSlotPosition}
          onChange={(e) => setNewSlotPosition(e.target.value)}
        />
        <input
          className="search-input small"
          type="number"
          min="1"
          value={newSlotCount}
          onChange={(e) => setNewSlotCount(e.target.value)}
        />
        <button
          type="button"
          disabled={!newSlotPosition.trim()}
          onClick={() => {
            setConfig({
              ...config,
              rosterSlots: [...config.rosterSlots, { position: newSlotPosition.trim(), count: Number(newSlotCount) || 1 }],
            });
            setNewSlotPosition("");
            setNewSlotCount("1");
          }}
        >
          Add slot
        </button>
      </div>

      <h4>Teams</h4>
      <ul className="editable-list">
        {config.teams.map((team, i) => (
          <li key={i}>
            <label>
              <input
                type="radio"
                name="ownTeam"
                checked={team.isOwnTeam}
                onChange={() =>
                  setConfig({ ...config, teams: config.teams.map((t, j) => ({ ...t, isOwnTeam: j === i })) })
                }
              />{" "}
              {team.name}
              {team.isOwnTeam ? " (you)" : ""}
            </label>{" "}
            <button
              type="button"
              onClick={() => setConfig({ ...config, teams: config.teams.filter((_, j) => j !== i) })}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="form-row">
        <input
          className="search-input"
          placeholder="Team name"
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
        />
        <button
          type="button"
          disabled={!newTeamName.trim()}
          onClick={() => {
            setConfig({
              ...config,
              teams: [...config.teams, { name: newTeamName.trim(), isOwnTeam: config.teams.length === 0 }],
            });
            setNewTeamName("");
          }}
        >
          Add team
        </button>
      </div>
      <p className="note">Mark the radio button next to your own team so the assistant knows which roster is yours.</p>
    </section>
  );
}

function DraftLog({
  config,
  picks,
  addPick,
  removeLastPick,
  resetPicks,
}: {
  config: ManualLeagueConfig;
  picks: ManualPick[];
  addPick: (pick: Omit<ManualPick, "pickNumber">) => void;
  removeLastPick: () => void;
  resetPicks: () => void;
}) {
  const [teamName, setTeamName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [position, setPosition] = useState("");

  return (
    <section className="panel">
      <h3>Draft log</h3>
      {config.teams.length === 0 ? (
        <p className="note">Add teams in League setup above before logging picks.</p>
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
          <input
            className="search-input"
            placeholder="Player name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
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
  const { config, setConfig, picks, addPick, removeLastPick, resetPicks, loaded } = useManualDraft();
  const suggestMutation = useMutation({
    mutationFn: () => api.suggestManualPick(config, picks),
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
          Yahoo, it's a standalone assistant fed by what you type in. Everything here is saved on the server
          (survives a redeploy and works from any browser), not just locally.
        </p>
      </section>

      <LeagueSetup config={config} setConfig={setConfig} />
      <DraftLog config={config} picks={picks} addPick={addPick} removeLastPick={removeLastPick} resetPicks={resetPicks} />

      <section className="panel">
        <h3>GPT recommendation</h3>
        <button disabled={!myTeam || suggestMutation.isPending} onClick={() => suggestMutation.mutate()}>
          {suggestMutation.isPending ? "Thinking…" : "Get recommendation for my next pick"}
        </button>
        {!myTeam && <p className="note">Mark your own team in League setup first.</p>}
        {suggestMutation.data && <p className="gpt-reply">{suggestMutation.data.reply}</p>}
        {suggestMutation.isError && <p className="state-message error">{String(suggestMutation.error)}</p>}
      </section>

      <section className="panel">
        <h3>Ask GPT</h3>
        <ChatBox leagueKey={null} manualContext={buildManualContext(config, picks)} />
      </section>
    </div>
  );
}
