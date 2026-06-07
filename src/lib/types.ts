// Shared types between Rust IPC and React UI.
// These mirror the structs defined in src-tauri/src/commands/*.rs.

export type StatusSymbol = "✅" | "❌" | "⚠️" | "🔄";

export interface TrackingRow {
  rank: number | null;
  game: string;
  monthlySearches: number | null;
  competitorUrl: string;
  status: StatusSymbol | "";
  notes: string;
}

export interface TrackingCounts {
  confirmed: number;   // ✅
  blocked: number;     // ❌
  needsReview: number; // ⚠️
  alreadyOnNowgg: number; // 🔄
}

export interface Competitor {
  name: string;                  // e.g. "CrazyGames"
  folder: string;                // absolute path to "X vs Now.gg"
  slug: string;                  // lowercase normalized name
  hasSimilarwebFile: boolean;
  similarwebFileName: string | null;
  similarwebAgeDays: number | null;
  hasGapAnalysis: boolean;
  gapAnalysisAgeDays: number | null;
  gapSize: number | null;
  counts: TrackingCounts;
  remaining: number | null;      // gapSize - investigated (clamped >= 0)
  isExhausted: boolean;
}

export interface RunLogRow {
  date: string;          // YYYY-MM-DD
  competitor: string;
  investigated: number;
  found: number;
  blocked: number;
  emailStatus: string;   // "✅ ID: ..." or "❌ Email failed"
  raw: string;           // original line for debugging
}

export interface LastRunSummary {
  date: string | null;
  time: string | null;
  competitor: string | null;
  investigated: number | null;
  found: number | null;
  blocked: number | null;
  nextGame: string | null;
  totalConfirmed: number | null;
  totalBlocked: number | null;
  remaining: number | null;
}

export interface EnvStatus {
  scriptsDir: string;
  agentRoot: string;
  tokenFileExists: boolean;
  tokenAgeDays: number | null;
  envFileExists: boolean;
  hasGithubToken: boolean;
  hasTavilyKey: boolean;
  hasSheetsId: boolean;
  nowggGamesCsvExists: boolean;
  nowggGamesCsvAgeDays: number | null;
  launchdDailyExists: boolean;
  launchdWeeklyExists: boolean;
}

// Errors from Rust come back as plain strings via Result<T, String>.
export type IpcError = string;
