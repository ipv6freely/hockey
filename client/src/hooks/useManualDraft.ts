import { useEffect, useState } from "react";
import type { ManualLeagueConfig, ManualPick } from "../../../src/shared/index";

const CONFIG_KEY = "manualDraft.config";
const PICKS_KEY = "manualDraft.picks";

const emptyConfig: ManualLeagueConfig = {
  leagueName: "",
  scoringNotes: "",
  draftType: "snake",
  rosterSlots: [],
  teams: [],
};

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** All state lives in localStorage — there's no server-side persistence for manual mode, see AGENTS.md. */
export function useManualDraft() {
  const [config, setConfig] = useState<ManualLeagueConfig>(() => load(CONFIG_KEY, emptyConfig));
  const [picks, setPicks] = useState<ManualPick[]>(() => load(PICKS_KEY, []));

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  }, [picks]);

  const addPick = (pick: Omit<ManualPick, "pickNumber">) => {
    setPicks((prev) => [...prev, { ...pick, pickNumber: prev.length + 1 }]);
  };

  const removeLastPick = () => setPicks((prev) => prev.slice(0, -1));
  const resetPicks = () => setPicks([]);

  return { config, setConfig, picks, addPick, removeLastPick, resetPicks };
}
