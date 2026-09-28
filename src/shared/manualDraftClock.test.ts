import { test } from "node:test";
import assert from "node:assert/strict";
import { computeManualDraftClock } from "./manualDraftClock.ts";
import type { ManualLeagueConfig } from "./index.ts";

const config: ManualLeagueConfig = {
  leagueName: "Test",
  scoringNotes: "",
  draftType: "snake",
  rosterSlots: [{ position: "C", count: 2 }], // 2 teams x 2 slots = 4 total picks
  teams: [
    { name: "A", isOwnTeam: true },
    { name: "B", isOwnTeam: false },
  ],
};

test("round 1 goes in listed order", () => {
  assert.equal(computeManualDraftClock(config, 0)?.onTheClockTeamName, "A");
  assert.equal(computeManualDraftClock(config, 1)?.onTheClockTeamName, "B");
});

test("round 2 reverses (snake)", () => {
  assert.equal(computeManualDraftClock(config, 2)?.onTheClockTeamName, "B");
  assert.equal(computeManualDraftClock(config, 3)?.onTheClockTeamName, "A");
});

test("reports round and 1-based position within round", () => {
  const clock = computeManualDraftClock(config, 2);
  assert.equal(clock?.round, 2);
  assert.equal(clock?.posInRound, 1);
  assert.equal(clock?.pickNumber, 3);
});

test("isComplete once every roster slot across every team is filled", () => {
  assert.equal(computeManualDraftClock(config, 3)?.isComplete, false);
  assert.equal(computeManualDraftClock(config, 4)?.isComplete, true);
  assert.equal(computeManualDraftClock(config, 4)?.onTheClockTeamName, "");
});

test("returns null when there isn't enough config to compute anything", () => {
  assert.equal(computeManualDraftClock({ ...config, teams: [] }, 0), null);
  assert.equal(computeManualDraftClock({ ...config, rosterSlots: [] }, 0), null);
});
