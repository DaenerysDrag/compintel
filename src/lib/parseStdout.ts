// Maps Python agent stdout lines to typed events the UI can render.
//
// The patterns here mirror the actual print() statements in:
//   - run_agent.py:        "Part N: ..."
//   - 3_source_hunter.py:  "[rank] GAME — VOL/mo", "  ✅ GitHub: ...", etc.
//
// Lines that don't match any pattern still flow through as RawLog so the
// LiveLog panel always shows everything — pattern matching only enriches.

export type StepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 8;

export interface StepStartEvent {
  kind: "step-start";
  step: StepNumber;
  label: string;
}
export interface StepDoneEvent {
  kind: "step-done";
  step: StepNumber;
  detail?: string;
}
export interface StepFailedEvent {
  kind: "step-failed";
  step: StepNumber;
  reason?: string;
}
export interface StepSkippedEvent {
  kind: "step-skipped";
  step: StepNumber;
  reason?: string;
}
export interface GameStartEvent {
  kind: "game-start";
  rank: number;
  name: string;
  volume: number;
}
export interface GameResultEvent {
  kind: "game-result";
  status: "confirmed" | "needs-review" | "blocked";
  url?: string;
  license?: string;
  stars?: number;
  source?: "github" | "itchio" | "web" | "dedup" | "ip-block" | "no-source";
}
export interface CrossCompetitorSkipEvent {
  kind: "cross-skip";
  rank: number;
  name: string;
  reason: string;
}
export interface RawLogEvent {
  kind: "raw";
  text: string;
}

export type ParsedEvent =
  | StepStartEvent
  | StepDoneEvent
  | StepFailedEvent
  | StepSkippedEvent
  | GameStartEvent
  | GameResultEvent
  | CrossCompetitorSkipEvent
  | RawLogEvent;

const STEP_LABELS: Record<StepNumber, string> = {
  1: "Pulling GSC data",
  2: "Gap analysis",
  3: "Source hunting",
  4: "Tech handoff report",
  5: "Sending email",
  6: "Updating CLAUDE.md",
  8: "Google Sheets upload",
};

// run_agent.py uses `log("Part N: ...")` which prefixes a timestamp.
// Strip leading timestamp if present so patterns match cleanly.
function stripTimestamp(line: string): string {
  // Format from run_agent.py log(): "[YYYY-MM-DD HH:MM:SS] message"
  return line.replace(/^\[\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\]\s*/, "");
}

export function parseLine(rawLine: string): ParsedEvent {
  const line = stripTimestamp(rawLine);

  // ── Step transitions ────────────────────────────────────────────────────
  const stepMatch = line.match(/^Part (\d+):\s*(.+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]) as StepNumber;
    const rest = stepMatch[2];

    if (rest.startsWith("Done")) {
      return { kind: "step-done", step, detail: rest.replace(/^Done\s*✅?\s*/, "").trim() || undefined };
    }
    if (rest.startsWith("FAILED")) {
      return { kind: "step-failed", step, reason: rest.replace(/^FAILED\s*❌?\s*/, "").trim() || undefined };
    }
    if (rest.startsWith("Skipped")) {
      return { kind: "step-skipped", step, reason: rest.replace(/^Skipped[\s—-]*/, "").trim() || undefined };
    }
    if (rest.startsWith("No gap files")) {
      return { kind: "step-failed", step, reason: rest };
    }
    return { kind: "step-start", step, label: STEP_LABELS[step] ?? rest };
  }

  // ── Game start: "[rank] Game Name — 1,234/mo" ───────────────────────────
  const gameStart = line.match(/^\[(\d+)\]\s+(.+?)\s+—\s+([\d,]+)\/mo/);
  if (gameStart) {
    return {
      kind: "game-start",
      rank: Number(gameStart[1]),
      name: gameStart[2].trim(),
      volume: Number(gameStart[3].replace(/,/g, "")),
    };
  }

  // ── Cross-competitor skip: "[rank] Name — already confirmed/blocked via X" ──
  const crossSkip = line.match(/^\[(\d+)\]\s+(.+?)\s+—\s+already\s+(confirmed|blocked)\s+via\s+(.+?),\s*skipping/);
  if (crossSkip) {
    return {
      kind: "cross-skip",
      rank: Number(crossSkip[1]),
      name: crossSkip[2].trim(),
      reason: `already ${crossSkip[3]} via ${crossSkip[4].trim()}`,
    };
  }

  // ── Game result patterns (within source hunter) ─────────────────────────
  // "  ✅ GitHub: https://... (MIT, ⭐42)"
  const ghHit = line.match(/^\s*✅\s+GitHub:\s+(\S+)\s+\((.+?),\s*⭐(\d+)\)/);
  if (ghHit) {
    return {
      kind: "game-result",
      status: "confirmed",
      url: ghHit[1],
      license: ghHit[2],
      stars: Number(ghHit[3]),
      source: "github",
    };
  }

  // "  ⚠️  Itch.io: https://..."
  const itchHit = line.match(/^\s*⚠️?\s+Itch\.io:\s+(\S+)/);
  if (itchHit) {
    return { kind: "game-result", status: "needs-review", url: itchHit[1], source: "itchio" };
  }

  // "  ✅ Web: https://..." or "  ⚠️  Needs review: https://..."
  const webHit = line.match(/^\s*(✅|⚠️?)\s+(Web|Needs\s+review):\s+(\S+)/);
  if (webHit) {
    const status = webHit[1] === "✅" ? "confirmed" : "needs-review";
    return { kind: "game-result", status, url: webHit[3], source: "web" };
  }

  // "  ❌ Commercial IP — skipping"
  if (/^\s*❌\s+Commercial\s+IP/.test(line)) {
    return { kind: "game-result", status: "blocked", source: "ip-block" };
  }

  // "  ❌ No usable source found"
  if (/^\s*❌\s+No\s+usable\s+source/.test(line)) {
    return { kind: "game-result", status: "blocked", source: "no-source" };
  }

  // "  ❌ Itch.io/Web source already identified via ..."
  if (/^\s*❌\s+(Itch\.io|Web)\s+source\s+already\s+identified/.test(line)) {
    return { kind: "game-result", status: "blocked", source: "dedup" };
  }

  return { kind: "raw", text: rawLine };
}
