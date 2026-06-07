// Zustand store for app-wide settings that persist across launches.
//
// Mode decides which tabs are visible and which data sources are used:
//   - viewer:   read-only. Hides Run Agent. Tabs read from a cloud snapshot URL
//               (no Python, no project folder, no API keys required).
//   - operator: full local agent. Shows Run Agent. Tabs read from the local
//               project folder via Tauri commands.
//
// State is persisted to `compintel-settings.json` in Tauri's app data directory
// (cross-platform: ~/Library/Application Support/com.nowgg.compintel on macOS,
// %APPDATA%\com.nowgg.compintel on Windows).

import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export type AppMode = "viewer" | "operator";

// Default snapshot URL — Drive direct-link to compintel-state.json uploaded by
// the agent's Part 9. Operator can override in Settings. Set to empty string
// here so a missing default doesn't silently mask a config gap on first run.
const DEFAULT_SNAPSHOT_URL = "";

interface SettingsState {
  // Persisted
  mode: AppMode;
  projectFolder: string | null;   // operator only — path to "Compitior Analysis/"
  snapshotUrl: string;             // viewer only — URL to compintel-state.json
  loaded: boolean;                 // becomes true after first load() completes

  // Actions
  load: () => Promise<void>;
  setMode: (mode: AppMode) => Promise<void>;
  setProjectFolder: (path: string | null) => Promise<void>;
  setSnapshotUrl: (url: string) => Promise<void>;
}

// Helper: persist current settings via the Rust `save_settings` command.
async function persist(state: Pick<SettingsState, "mode" | "projectFolder" | "snapshotUrl">) {
  try {
    await invoke("save_settings", {
      mode: state.mode,
      projectFolder: state.projectFolder,
      snapshotUrl: state.snapshotUrl,
    });
  } catch (err) {
    // Non-fatal — the in-memory state still works for this session.
    console.warn("save_settings failed:", err);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  mode: "viewer",                  // safe default — read-only, no surprises
  projectFolder: null,
  snapshotUrl: DEFAULT_SNAPSHOT_URL,
  loaded: false,

  load: async () => {
    try {
      const loaded = await invoke<{
        mode: AppMode;
        projectFolder: string | null;
        snapshotUrl: string;
      }>("load_settings");
      set({
        mode: loaded.mode || "viewer",
        projectFolder: loaded.projectFolder,
        snapshotUrl: loaded.snapshotUrl || DEFAULT_SNAPSHOT_URL,
        loaded: true,
      });
    } catch (err) {
      // First launch or corrupt file — fall back to defaults, mark loaded so
      // UI can proceed without spinning forever.
      console.warn("load_settings failed (defaults in use):", err);
      set({ loaded: true });
    }
  },

  setMode: async (mode) => {
    set({ mode });
    await persist({ ...get(), mode });
  },

  setProjectFolder: async (path) => {
    set({ projectFolder: path });
    await persist({ ...get(), projectFolder: path });
  },

  setSnapshotUrl: async (url) => {
    set({ snapshotUrl: url });
    await persist({ ...get(), snapshotUrl: url });
  },
}));

// Convenience selectors
export const selectIsViewer = (s: SettingsState) => s.mode === "viewer";
export const selectIsOperator = (s: SettingsState) => s.mode === "operator";
