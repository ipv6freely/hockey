import { useEffect, useRef, useState } from "react";
import { api } from "../api.ts";
import type { ManualLeagueConfig, ManualPick } from "../../../src/shared/index";

const emptyConfig: ManualLeagueConfig = {
  leagueName: "",
  scoringNotes: "",
  draftType: "snake",
  rosterSlots: [],
  teams: [],
};

/**
 * Persisted server-side to data/manual-draft.json (the same Railway volume
 * the Yahoo token/cache already need — see README), not localStorage: state
 * needs to survive a redeploy and be readable from more than one browser.
 * Local React state stays the source of truth for rendering; saves to the
 * server are debounced so typing in a text field doesn't fire a request per
 * keystroke. suggest/chat calls send the in-memory state directly rather
 * than relying on this debounced copy having landed yet.
 */
export function useManualDraft() {
  const [config, setConfig] = useState<ManualLeagueConfig>(emptyConfig);
  const [picks, setPicks] = useState<ManualPick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getManualDraftState().then((state) => {
      setConfig(state.config);
      setPicks(state.picks);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!loaded) return; // don't overwrite the real saved state with the initial empty one while it's still loading
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.saveManualDraftState({ config, picks }).catch(() => {
        // best-effort background sync — suggest/chat work from in-memory state either way
      });
    }, 500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [config, picks, loaded]);

  const addPick = (pick: Omit<ManualPick, "pickNumber">) => {
    setPicks((prev) => [...prev, { ...pick, pickNumber: prev.length + 1 }]);
  };

  const removeLastPick = () => setPicks((prev) => prev.slice(0, -1));
  const resetPicks = () => setPicks([]);

  return { config, setConfig, picks, addPick, removeLastPick, resetPicks, loaded };
}
