// Snapshot store — fetches compintel-state.json from the configured URL
// (viewer mode) and exposes it to Dashboard / Competitors / History tabs.
//
// On launch: tries cache first (instant render), then fetches fresh in
// background. Subsequent navigations hit the cached store instantly.

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface SnapshotSummary {
  date?: string;
  time?: string;
  competitor?: string;
  investigated?: number;
  found?: number;
  blocked?: number;
  nextGame?: string;
  totalConfirmed?: number;
  totalBlocked?: number;
  remaining?: number;
}

export interface SnapshotCompetitor {
  name: string;
  slug: string;
  counts: {
    confirmed: number;
    blocked: number;
    needsReview: number;
    alreadyOnNowgg: number;
  };
  gapSize: number | null;
  remaining: number | null;
  isExhausted: boolean;
  similarwebFile: string | null;
  similarwebAgeDays: number | null;
}

export interface SnapshotRunLogRow {
  date: string;
  competitor: string;
  investigated: number;
  found: number;
  blocked: number;
  emailStatus: string;
}

export interface SnapshotSheets {
  sheetId?: string;
  url?: string;
}

export interface Snapshot {
  version: number;
  generatedAt: string;
  agentVersion: string;
  summary: SnapshotSummary;
  competitors: SnapshotCompetitor[];
  runLog: SnapshotRunLogRow[];
  sheets: SnapshotSheets;
}

interface SnapshotState {
  data: Snapshot | null;
  loading: boolean;
  fromCache: boolean;          // true if `data` came from the offline cache
  error: string | null;
  lastFetchAt: number | null;

  load: (url: string) => Promise<void>;
  reset: () => void;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
  data: null,
  loading: false,
  fromCache: false,
  error: null,
  lastFetchAt: null,

  load: async (url: string) => {
    if (get().loading) return;
    set({ loading: true, error: null });

    // Instant render from cache if available, then fetch fresh in background.
    try {
      const cached = await invoke<Snapshot | null>("get_cached_snapshot");
      if (cached) {
        set({ data: cached, fromCache: true });
      }
    } catch {
      // Cache miss is fine — fall through to network fetch.
    }

    if (!url || !url.trim()) {
      set({
        loading: false,
        error: get().data
          ? null
          : "No snapshot URL configured. Open Settings → paste the snapshot URL provided by your admin.",
      });
      return;
    }

    try {
      const fresh = await invoke<Snapshot>("fetch_snapshot", { url });
      set({
        data: fresh,
        fromCache: false,
        loading: false,
        error: null,
        lastFetchAt: Date.now(),
      });
    } catch (err) {
      // Network failure — keep cached data (if any) so viewer is still useful offline.
      set({
        loading: false,
        error: get().data
          ? `Could not refresh snapshot — showing last cached copy. (${String(err)})`
          : `Could not load snapshot: ${String(err)}`,
      });
    }
  },

  reset: () => {
    set({ data: null, loading: false, fromCache: false, error: null, lastFetchAt: null });
  },
}));
