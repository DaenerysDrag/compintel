// Diagnostics + feedback plumbing (V2.1).
//
// Pure frontend — no Rust commands, no new deps. Collects app/runtime info,
// captures the last crash to localStorage (a lightweight "local log" that
// survives a reload), and builds prefilled GitHub issue URLs so a tester can
// report a bug or idea in two clicks. A Rust-backed crash-log *file* can come
// later if we want true on-disk persistence; this ships value now.

export const APP_VERSION = "0.2.0";
export const REPO_SLUG = "DaenerysDrag/compintel";

const CRASH_KEY = "compintel:lastCrash";

export interface CrashRecord {
  at: string;        // ISO timestamp
  message: string;
  stack?: string;
  source: "boundary" | "window-error" | "unhandled-rejection";
}

/** Best-effort OS/runtime string from the webview (no plugin needed). */
export function runtimeInfo(): string {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const platform = (nav as { userAgentData?: { platform?: string } })?.userAgentData?.platform
    || nav?.platform
    || "unknown";
  return `${platform} · ${nav?.userAgent ?? "no-ua"}`;
}

/** Persist a crash so it survives a reload and can be attached to a report. */
export function recordCrash(rec: CrashRecord): void {
  try {
    localStorage.setItem(CRASH_KEY, JSON.stringify(rec));
  } catch {
    // localStorage can throw in private mode / quota — non-fatal.
  }
}

export function lastCrash(): CrashRecord | null {
  try {
    const raw = localStorage.getItem(CRASH_KEY);
    return raw ? (JSON.parse(raw) as CrashRecord) : null;
  } catch {
    return null;
  }
}

export function clearCrash(): void {
  try {
    localStorage.removeItem(CRASH_KEY);
  } catch {
    /* non-fatal */
  }
}

/** Register global handlers so uncaught errors/rejections are captured too. */
export function initCrashCapture(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    recordCrash({
      at: new Date().toISOString(),
      message: e.message || String(e.error ?? "unknown error"),
      stack: e.error?.stack,
      source: "window-error",
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    recordCrash({
      at: new Date().toISOString(),
      message: reason?.message ? String(reason.message) : String(reason),
      stack: reason?.stack,
      source: "unhandled-rejection",
    });
  });
}

/** The diagnostics block we attach to every report — copyable + prefilled. */
export function diagnosticsBlock(extra?: { mode?: string }): string {
  const crash = lastCrash();
  const lines = [
    `App version: ${APP_VERSION}`,
    `Mode: ${extra?.mode ?? "unknown"}`,
    `Runtime: ${runtimeInfo()}`,
    `Captured: ${new Date().toISOString()}`,
  ];
  if (crash) {
    lines.push(
      "",
      `Last crash (${crash.source}) at ${crash.at}:`,
      crash.message,
      crash.stack ? "```\n" + crash.stack.slice(0, 2000) + "\n```" : "",
    );
  }
  return lines.filter((l) => l !== undefined).join("\n");
}

export type FeedbackKind = "bug" | "idea";

/** Build a prefilled GitHub "new issue" URL. Labels omitted on purpose —
 *  they 404 the form for non-maintainers if the label doesn't exist. */
export function feedbackIssueUrl(kind: FeedbackKind, opts?: { mode?: string }): string {
  const titlePrefix = kind === "bug" ? "[Bug] " : "[Idea] ";
  const heading =
    kind === "bug"
      ? "### What happened?\n\n\n### Steps to reproduce\n\n\n### What did you expect?\n\n"
      : "### What would you like to see?\n\n\n### Why is it useful?\n\n";
  const body = `${heading}\n---\n<details><summary>Diagnostics (auto-filled)</summary>\n\n${diagnosticsBlock(opts)}\n\n</details>`;
  const params = new URLSearchParams({ title: titlePrefix, body });
  return `https://github.com/${REPO_SLUG}/issues/new?${params.toString()}`;
}
