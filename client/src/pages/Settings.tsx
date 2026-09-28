import { useState } from "react";
import { useManualDraft } from "../hooks/useManualDraft.ts";
import type { ManualLeagueConfig } from "../../../src/shared/index";

type SetConfig = (config: ManualLeagueConfig) => void;

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

      <h4>Teams &amp; draft order</h4>
      <ul className="editable-list">
        {config.teams.map((team, i) => {
          const moveTeam = (direction: -1 | 1) => {
            const j = i + direction;
            if (j < 0 || j >= config.teams.length) return;
            const teams = [...config.teams];
            [teams[i], teams[j]] = [teams[j], teams[i]];
            setConfig({ ...config, teams });
          };
          return (
            <li key={i}>
              <span className="draft-order-num">{i + 1}.</span>
              <button type="button" className="move-btn" onClick={() => moveTeam(-1)} disabled={i === 0} title="Move up">
                ↑
              </button>
              <button
                type="button"
                className="move-btn"
                onClick={() => moveTeam(1)}
                disabled={i === config.teams.length - 1}
                title="Move down"
              >
                ↓
              </button>
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
          );
        })}
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
      <p className="note">
        The list order above is the draft order (round 1 goes top to bottom) — use ↑/↓ once your league sets the
        real pick order. Mark the radio button next to your own team so the assistant knows which roster is yours.
      </p>
    </section>
  );
}

const SAVE_STATUS_LABEL: Record<string, string> = {
  idle: "Save",
  saving: "Saving…",
  saved: "Saved ✓",
  error: "Save failed — try again",
};

export function SettingsPage() {
  const { config, setConfig, saveConfig, loaded, saveStatus } = useManualDraft();

  if (!loaded) {
    return <p className="state-message">Loading…</p>;
  }

  return (
    <div className="settings-page">
      <section className="panel">
        <p className="note">
          League name, scoring, roster slots, and teams for Manual Draft — set this up once before the draft, then
          log picks on the Manual Draft tab as they happen. Edits here aren't saved until you click Save.
        </p>
      </section>
      <LeagueSetup config={config} setConfig={setConfig} />
      <section className="panel">
        <button onClick={saveConfig} disabled={saveStatus === "saving"}>
          {SAVE_STATUS_LABEL[saveStatus]}
        </button>
        {saveStatus === "error" && (
          <p className="state-message error">Couldn't save — check your connection and try again.</p>
        )}
      </section>
    </div>
  );
}
