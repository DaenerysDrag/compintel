// Typed wrappers around Tauri invoke. Single source of truth for command names.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  Competitor,
  EnvStatus,
  LastRunSummary,
  RunLogRow,
} from "./types";

export interface UploadResult {
  destination: string;
  fileName: string;
  bytes: number;
}

export interface AddCompetitorResult {
  folder: string;
  slug: string;
  name: string;
}

export const ipc = {
  // Read-only views
  listCompetitors:     () => invoke<Competitor[]>("list_competitors"),
  readRunLog:          () => invoke<RunLogRow[]>("read_run_log"),
  readLastRunSummary:  () => invoke<LastRunSummary>("read_last_run_summary"),
  readEnvStatus:       () => invoke<EnvStatus>("read_env_status"),
  openPath:            (path: string) => invoke<void>("open_path", { path }),
  // Opens an external URL in the user's default browser (so Google login works)
  openUrl:             (url: string) => openUrl(url),

  // File operations
  uploadSimilarwebFile: (sourcePath: string, competitorSlug: string) =>
    invoke<UploadResult>("upload_similarweb_file", { sourcePath, competitorSlug }),

  // Add a new competitor (creates folder + game-tracking-list.md, same format as the Python agent)
  addCompetitor: (name: string) =>
    invoke<AddCompetitorResult>("add_competitor", { name }),

  // Log tailing
  startLogTail: (channel: "daily" | "weekly") =>
    invoke<void>("start_log_tail", { channel }),
  stopLogTail: (channel: "daily" | "weekly") =>
    invoke<void>("stop_log_tail", { channel }),

  // Dialog helpers (frontend convenience — opens system file picker)
  pickXlsxFile: async (): Promise<string | null> => {
    const selected = await openDialog({
      multiple: false,
      directory: false,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    return typeof selected === "string" ? selected : null;
  },
};
