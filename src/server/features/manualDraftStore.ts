import fs from "node:fs/promises";
import path from "node:path";
import type { ManualDraftState } from "../../shared/index.ts";
import { manualDraftPath } from "../config.ts";

const emptyState: ManualDraftState = {
  config: { leagueName: "", scoringNotes: "", draftType: "snake", rosterSlots: [], teams: [] },
  picks: [],
};

export async function loadManualDraftState(): Promise<ManualDraftState> {
  try {
    return JSON.parse(await fs.readFile(manualDraftPath, "utf8")) as ManualDraftState;
  } catch {
    return emptyState;
  }
}

export async function saveManualDraftState(state: ManualDraftState): Promise<void> {
  await fs.mkdir(path.dirname(manualDraftPath), { recursive: true });
  const tmp = `${manualDraftPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.rename(tmp, manualDraftPath);
}
