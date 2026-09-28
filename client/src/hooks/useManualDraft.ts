import { useEffect, useState } from "react";
import { api } from "../api.ts";
import type { ManualLeagueConfig, ManualPick } from "../../../src/shared/index";

const emptyConfig: ManualLeagueConfig = {
  leagueName: "",
  scoringNotes: "",
  draftType: "snake",
  rosterSlots: [],
  teams: [],
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Persisted server-side to data/manual-draft.json (the same Railway volume
 * the Yahoo token/cache already need — see README), not localStorage: state
 * needs to survive a redeploy and be readable from more than one browser.
 *
 * No auto-save/debounce: league config edits only persist when `saveConfig`
 * is called (the Settings page's explicit Save button) — silent auto-save
 * made it unclear whether an edit had actually landed before switching
 * tabs. Picks are different: `addPick`/`removeLastPick`/`resetPicks` are
 * already discrete button-click actions, not continuous typing, so they
 * persist immediately rather than needing their own save button.
 */
export function useManualDraft() {
  const [config, setConfig] = useState<ManualLeagueConfig>(emptyConfig);
  const [picks, setPicks] = useState<ManualPick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    api.getManualDraftState().then((state) => {
      setConfig(state.config);
      setPicks(state.picks);
      setLoaded(true);
    });
  }, []);

  async function persist(next: { config: ManualLeagueConfig; picks: ManualPick[] }) {
    setSaveStatus("saving");
    try {
      await api.saveManualDraftState(next);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  const saveConfig = () => persist({ config, picks });

  /** Wraps the raw setter so any further edit un-marks a previous "saved" as stale, rather than leaving a stale "Saved ✓" showing next to unsaved changes. */
  const updateConfig = (next: ManualLeagueConfig) => {
    setConfig(next);
    setSaveStatus("idle");
  };

  const addPick = (pick: Omit<ManualPick, "pickNumber">) => {
    const next = [...picks, { ...pick, pickNumber: picks.length + 1 }];
    setPicks(next);
    persist({ config, picks: next });
  };

  const removeLastPick = () => {
    const next = picks.slice(0, -1);
    setPicks(next);
    persist({ config, picks: next });
  };

  const resetPicks = () => {
    setPicks([]);
    persist({ config, picks: [] });
  };

  return { config, setConfig: updateConfig, saveConfig, picks, addPick, removeLastPick, resetPicks, loaded, saveStatus };
}
