// Zustand store for the active agent run.
// Subscribes to Tauri events emitted from src-tauri/src/run_agent.rs.

import { create } from "zustand";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { parseLine, type StepNumber } from "../lib/parseStdout";

export type StepStatus = "pending" | "active" | "done" | "failed" | "skipped";

export interface StepState {
  step: StepNumber;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface GameState {
  id: string; // synthesized: `${rank}-${name}` or fallback
  rank: number;
  name: string;
  volume: number;
  status: "investigating" | "confirmed" | "needs-review" | "blocked" | "skipped";
  url?: string;
  license?: string;
  stars?: number;
  source?: string;
  enteredAt: number;
}

export interface LogLine {
  id: number;
  stream: "stdout" | "stderr";
  text: string;
  tsMs: number;
}

interface RunState {
  // Lifecycle
  runId: string | null;
  running: boolean;
  done: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  exitCode: number | null;
  errorMessage: string | null;
  isDemo: boolean;

  // Live state
  steps: StepState[];
  currentStep: StepNumber | null;
  games: GameState[];
  currentGame: GameState | null;
  logLines: LogLine[];
  logCounter: number;

  // Actions
  start: (competitor: string | null) => Promise<void>;
  startDemo: () => Promise<void>;
  stop: () => Promise<void>;
  reset: () => void;
  _ingestLine: (stream: "stdout" | "stderr", line: string, tsMs: number) => void;
  _markDone: (exitCode: number | null) => void;
}

const STEP_ORDER: StepNumber[] = [1, 2, 3, 4, 8, 5, 6];
const STEP_LABELS: Record<StepNumber, string> = {
  1: "Pull GSC data",
  2: "Gap analysis",
  3: "Hunt sources",
  4: "Tech handoff",
  5: "Send email",
  6: "Update memory",
  8: "Upload sheets",
};

function freshSteps(): StepState[] {
  return STEP_ORDER.map((s) => ({ step: s, label: STEP_LABELS[s], status: "pending" }));
}

// Module-scope event subscription handles — initialized once per app load.
let unlistenStdout: UnlistenFn | null = null;
let unlistenDone: UnlistenFn | null = null;
const MAX_LOG_LINES = 500;

export const useRunStore = create<RunState>((set, get) => ({
  runId: null,
  running: false,
  done: false,
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  errorMessage: null,
  isDemo: false,
  steps: freshSteps(),
  currentStep: null,
  games: [],
  currentGame: null,
  logLines: [],
  logCounter: 0,

  start: async (competitor) => {
    if (get().running) return;

    // Wipe prior state so a re-run starts clean.
    set({
      runId: null,
      running: true,
      done: false,
      isDemo: false,
      startedAt: Date.now(),
      finishedAt: null,
      exitCode: null,
      errorMessage: null,
      steps: freshSteps(),
      currentStep: null,
      games: [],
      currentGame: null,
      logLines: [],
      logCounter: 0,
    });

    // Wire event listeners on first start (idempotent across reruns).
    if (!unlistenStdout) {
      unlistenStdout = await listen<{ runId: string; stream: "stdout" | "stderr"; line: string; tsMs: number }>(
        "agent:stdout",
        (event) => {
          const { stream, line, tsMs } = event.payload;
          get()._ingestLine(stream, line, tsMs);
        },
      );
    }
    if (!unlistenDone) {
      unlistenDone = await listen<{ runId: string; exitCode: number | null; durationMs: number }>(
        "agent:done",
        (event) => {
          get()._markDone(event.payload.exitCode);
        },
      );
    }

    try {
      const runId = await invoke<string>("start_agent", {
        competitor: competitor && competitor.trim().length > 0 ? competitor : null,
      });
      set({ runId });
    } catch (err) {
      set({
        running: false,
        done: true,
        errorMessage: String(err),
        finishedAt: Date.now(),
      });
    }
  },

  stop: async () => {
    if (get().isDemo) {
      get()._markDone(0);
      return;
    }
    try {
      await invoke("stop_agent");
    } catch (err) {
      console.warn("stop_agent:", err);
    }
  },

  startDemo: async () => {
    if (get().running) return;

    set({
      runId: "demo-run",
      running: true,
      done: false,
      isDemo: true,
      startedAt: Date.now(),
      finishedAt: null,
      exitCode: null,
      errorMessage: null,
      steps: freshSteps(),
      currentStep: null,
      games: [],
      currentGame: null,
      logLines: [],
      logCounter: 0,
    });

    // Scripted scenario — matches the real agent's stdout shape so parseLine handles it.
    const script: [number, string][] = [
      [0,    "==============================================="],
      [50,   "now.gg Competitor Analysis Agent — Starting"],
      [50,   "Date: 2026-05-24"],
      [100,  "==============================================="],
      [400,  "Part 1: Pulling GSC data..."],
      [1500, "Pulled 24,827 rows from GSC"],
      [200,  "Part 1: Done ✅"],
      [400,  "Part 2: Running gap analysis..."],
      [1800, "Gap CSV unchanged — 1,247 games available"],
      [200,  "Part 2: Done ✅ — 1 competitor(s) processed"],
      [400,  "Part 3: Hunting sources (target: 5 confirmed)..."],
      [600,  "Previously investigated: 47 games"],
      [800,  "[12] Spider Solitaire — 1,187,820/mo"],
      [1500, "  ✅ GitHub: https://github.com/lklynet/spider-solitaire  (MIT, ⭐47)"],
      [600,  "[13] Slice Master — 953,180/mo"],
      [1400, "  No GitHub hit — checking itch.io..."],
      [1000, "  ⚠️  Itch.io: https://iagodahlem.itch.io/knife-hit"],
      [600,  "[14] WorldGuessr — 825,540/mo"],
      [1800, "  ✅ GitHub: https://github.com/codergautam/worldguessr  (MIT, ⭐128)"],
      [600,  "[15] BuildNow GG — 800,160/mo"],
      [1300, "  ❌ Commercial IP — skipping (legal risk)"],
      [600,  "[16] Sprunki — 659,680/mo"],
      [1100, "  No GitHub hit — checking itch.io..."],
      [800,  "  No itch.io hit — web search..."],
      [800,  "  ❌ No usable source found"],
      [600,  "[17] Chess (with AI) — 580,260/mo"],
      [1600, "  ✅ GitHub: https://github.com/alaesahbou/chessAI  (MIT, ⭐89)"],
      [600,  "[18] Hop Ball — 606,110/mo"],
      [1300, "  ❌ No usable source found"],
      [600,  "[19] Erth Poker — 414,290/mo"],
      [1500, "  ✅ GitHub: https://github.com/erth-org/poker  (Apache-2.0, ⭐34)"],
      [400,  "Investigated 8 games — ✅ 4 confirmed  ⚠️  1 needs review"],
      [200,  "Part 3: Done ✅ — 4 confirmed + 1 needs review"],
      [400,  "Part 4: Generating tech handoff report..."],
      [800,  "Tech handoff saved: tech-handoff-2026-05-24.md"],
      [200,  "Part 4: Done ✅ — tech-handoff-2026-05-24.md"],
      [400,  "Part 8: Uploading to Google Sheets..."],
      [1200, "Sheet updated: https://docs.google.com/spreadsheets/d/..."],
      [200,  "Part 8: Done ✅"],
      [400,  "Part 5: Sending email..."],
      [1000, "Email sent. Message ID: 19e4dafe90951120"],
      [200,  "Part 5: Done ✅ — Email sent to karan.makol@bluestacks.com"],
      [400,  "Part 6: Updating CLAUDE.md memory..."],
      [600,  "Part 6: Done ✅ — CLAUDE.md updated"],
      [400,  "==============================================="],
      [50,   "Agent run complete in 18s"],
      [50,   "Sources found: 5"],
      [50,   "==============================================="],
    ];

    // Stream the script through the same _ingestLine path the real run uses.
    let cancelled = false;
    const cancelCheck = () => !get().running || get().isDemo === false || cancelled;

    const runScript = async () => {
      for (const [delay, line] of script) {
        await new Promise((r) => setTimeout(r, delay));
        if (cancelCheck()) {
          cancelled = true;
          return;
        }
        get()._ingestLine("stdout", line, Date.now());
      }
      // Natural completion
      get()._markDone(0);
    };

    runScript();
  },

  reset: () => {
    set({
      runId: null,
      running: false,
      done: false,
      isDemo: false,
      startedAt: null,
      finishedAt: null,
      exitCode: null,
      errorMessage: null,
      steps: freshSteps(),
      currentStep: null,
      games: [],
      currentGame: null,
      logLines: [],
      logCounter: 0,
    });
  },

  _ingestLine: (stream, line, tsMs) => {
    // Always append to log (capped).
    set((state) => {
      const nextLines = [
        ...state.logLines,
        { id: state.logCounter, stream, text: line, tsMs },
      ];
      const trimmed = nextLines.length > MAX_LOG_LINES
        ? nextLines.slice(nextLines.length - MAX_LOG_LINES)
        : nextLines;
      return { logLines: trimmed, logCounter: state.logCounter + 1 };
    });

    const evt = parseLine(line);
    switch (evt.kind) {
      case "step-start": {
        set((state) => {
          const steps = state.steps.map((s) => {
            if (s.step === evt.step) return { ...s, status: "active" as const, detail: evt.label };
            // Anything not-yet-active stays pending. Anything past stays as-is.
            return s;
          });
          return { steps, currentStep: evt.step };
        });
        break;
      }
      case "step-done": {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.step === evt.step ? { ...s, status: "done" as const, detail: evt.detail } : s,
          ),
        }));
        break;
      }
      case "step-failed": {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.step === evt.step ? { ...s, status: "failed" as const, detail: evt.reason } : s,
          ),
        }));
        break;
      }
      case "step-skipped": {
        set((state) => ({
          steps: state.steps.map((s) =>
            s.step === evt.step ? { ...s, status: "skipped" as const, detail: evt.reason } : s,
          ),
        }));
        break;
      }
      case "game-start": {
        const game: GameState = {
          id: `${evt.rank}-${evt.name}`,
          rank: evt.rank,
          name: evt.name,
          volume: evt.volume,
          status: "investigating",
          enteredAt: Date.now(),
        };
        set((state) => ({
          currentGame: game,
          games: [game, ...state.games].slice(0, 50), // most recent first, cap at 50
        }));
        break;
      }
      case "game-result": {
        // Mutate the most recent game (it's at index 0 since we prepended).
        set((state) => {
          if (state.games.length === 0) return state;
          const updated = [...state.games];
          updated[0] = {
            ...updated[0],
            status: evt.status,
            url: evt.url ?? updated[0].url,
            license: evt.license ?? updated[0].license,
            stars: evt.stars ?? updated[0].stars,
            source: evt.source ?? updated[0].source,
          };
          return { games: updated, currentGame: updated[0] };
        });
        break;
      }
      case "cross-skip": {
        const game: GameState = {
          id: `${evt.rank}-${evt.name}-skip`,
          rank: evt.rank,
          name: evt.name,
          volume: 0,
          status: "skipped",
          source: "dedup",
          enteredAt: Date.now(),
        };
        set((state) => ({
          games: [game, ...state.games].slice(0, 50),
        }));
        break;
      }
      case "raw":
        // Already in log; no structured change.
        break;
    }
  },

  _markDone: (exitCode) => {
    set((state) => {
      // Mark any still-active step as failed if exit was non-zero, else done.
      const steps = state.steps.map((s) => {
        if (s.status === "active") {
          return { ...s, status: exitCode === 0 ? "done" : "failed" } as StepState;
        }
        return s;
      });
      return {
        running: false,
        done: true,
        finishedAt: Date.now(),
        exitCode,
        currentStep: null,
        currentGame: null,
        steps,
      };
    });
  },
}));

// Derived selectors
export const selectElapsedMs = (s: RunState) =>
  s.startedAt ? (s.finishedAt ?? Date.now()) - s.startedAt : 0;

export const selectCounts = (s: RunState) => {
  let confirmed = 0;
  let needsReview = 0;
  let blocked = 0;
  let skipped = 0;
  for (const g of s.games) {
    if (g.status === "confirmed") confirmed++;
    else if (g.status === "needs-review") needsReview++;
    else if (g.status === "blocked") blocked++;
    else if (g.status === "skipped") skipped++;
  }
  return { confirmed, needsReview, blocked, skipped, total: s.games.length };
};
