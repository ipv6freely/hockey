// Types shared between the Fastify server and the React client. Plain
// data shapes only — no server- or browser-only imports here so this file
// can be imported from both sides by relative path (no workspace package).

export interface AuthStatus {
  connected: boolean;
  expiresAt: string | null;
}

export interface StatusResponse {
  yahooConnected: boolean;
  yahooConfigured: boolean;
  openaiConfigured: boolean;
  defaultLeagueKey: string | null;
}

export interface LeagueSummary {
  leagueKey: string;
  leagueId: string;
  name: string;
  season: string;
  numTeams: number;
  scoringType: string;
  draftStatus: string;
  isFinished: boolean;
}

export interface RosterPositionSlot {
  position: string;
  count: number;
  isStartingPosition: boolean;
}

export interface StatCategory {
  statId: number;
  name: string;
  displayName: string;
  group: "skater" | "goalie" | "misc";
  isOnlyDisplayStat: boolean;
}

export interface LeagueSettings {
  leagueKey: string;
  name: string;
  season: string;
  numTeams: number;
  scoringType: string;
  draftType: string;
  draftStatus: string;
  draftTime: string | null;
  currentWeek: number | null;
  isFinished: boolean;
  rosterPositions: RosterPositionSlot[];
  statCategories: StatCategory[];
}

export interface TeamSummary {
  teamKey: string;
  teamId: string;
  name: string;
  managerName: string | null;
  isOwnTeam: boolean;
  logoUrl: string | null;
  draftGrade: string | null;
}

export interface StandingsEntry {
  teamKey: string;
  teamName: string;
  rank: number | null;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number | null;
  pointsAgainst: number | null;
}

export interface PlayerSummary {
  playerKey: string;
  playerId: string;
  name: string;
  editorialTeamAbbr: string | null;
  positions: string[];
  selectedPosition: string | null;
  status: string | null;
  percentOwned: number | null;
  rank: number | null;
}

export interface DraftPick {
  pickNumber: number;
  round: number;
  teamKey: string;
  playerKey: string | null;
  playerName: string | null;
  cost: number | null;
}

export interface DraftState {
  leagueKey: string;
  draftStatus: string;
  draftType: string;
  totalPicks: number;
  picks: DraftPick[];
  currentPickNumber: number | null;
  currentRound: number | null;
  onTheClockTeamKey: string | null;
  draftOrder: string[];
}

export interface DraftSuggestion {
  reply: string;
  model: string;
  generatedAt: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  model: string;
  generatedAt: string;
}

// Manual-entry mode: for use while Yahoo API access is blocked (see
// AGENTS.md). Persisted server-side to data/manual-draft.json — see
// features/manualDraftStore.ts — not tied to a specific league/team API.

export interface NhlPlayer {
  id: number;
  name: string;
  team: string;
  position: string;
}

export interface ManualRosterSlot {
  position: string;
  count: number;
}

export interface ManualTeam {
  name: string;
  isOwnTeam: boolean;
}

export interface ManualLeagueConfig {
  leagueName: string;
  scoringNotes: string;
  draftType: "snake" | "auction" | "other";
  rosterSlots: ManualRosterSlot[];
  teams: ManualTeam[];
}

export interface ManualPick {
  pickNumber: number;
  teamName: string;
  playerName: string;
  position: string;
}

export interface ManualDraftState {
  config: ManualLeagueConfig;
  picks: ManualPick[];
}
