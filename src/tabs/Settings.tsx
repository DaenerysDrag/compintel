import { useEffect, useState } from "react";
import { ipc } from "../lib/ipc";
import type { EnvStatus } from "../lib/types";
import { Card, Pill } from "../components/Card";
import { LogTail } from "../components/LogTail";
import { useSettingsStore } from "../store/settingsStore";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

function PathRow({ label, path, exists }: { label: string; path: string; exists?: boolean }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-white/[0.03] last:border-0">
      <div>
        <div className="text-sm text-text">{label}</div>
        <code className="text-[11px] text-text-dim font-mono">{path}</code>
      </div>
      <div className="flex items-center gap-2">
        {exists !== undefined && (
          <Pill variant={exists ? "green" : "red"}>{exists ? "exists" : "missing"}</Pill>
        )}
        {exists && (
          <button
            onClick={() => ipc.openPath(path).catch(console.error)}
            className="text-[11px] px-2 py-1 rounded border border-cyan/30 text-cyan hover:bg-cyan/10 transition"
          >
            Open
          </button>
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Compintel mode + connection settings (cross-platform, persisted by Rust)
  const { mode, projectFolder, snapshotUrl, setMode, setProjectFolder, setSnapshotUrl } =
    useSettingsStore();
  const [snapshotUrlDraft, setSnapshotUrlDraft] = useState(snapshotUrl);

  // Re-sync draft when persisted value changes (e.g., after save_settings round-trip).
  useEffect(() => {
    setSnapshotUrlDraft(snapshotUrl);
  }, [snapshotUrl]);

  useEffect(() => {
    // Operator mode reads local agent files; viewer mode skips (no project folder).
    if (mode === "operator") {
      ipc.readEnvStatus().then(setEnv).catch((e) => setError(String(e)));
    } else {
      setEnv(null);
      setError(null);
    }
  }, [mode]);

  const pickProjectFolder = async () => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked === "string" && picked) {
        await setProjectFolder(picked);
      }
    } catch (e) {
      console.warn("folder picker:", e);
    }
  };

  const useDefaultProjectFolder = async () => {
    try {
      const def = await invoke<string | null>("get_default_project_folder");
      if (def) {
        await setProjectFolder(def);
      }
    } catch (e) {
      console.warn("get_default_project_folder:", e);
    }
  };

  const tokenWarn = (env?.tokenAgeDays ?? 0) > 150;

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-text-dim mt-1">
          Mode, connection, credentials, and scheduled job status.
        </p>
      </div>

      <div className="space-y-4">
        {/* App Mode — Viewer vs Operator */}
        <Card title="App Mode" accent="cyan">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => void setMode("viewer")}
                className={`text-left p-4 rounded border transition-colors ${
                  mode === "viewer"
                    ? "border-cyan/60 bg-cyan/5"
                    : "border-white/[0.08] hover:border-white/[0.2]"
                }`}
              >
                <div className="text-sm font-semibold text-white">Viewer</div>
                <div className="text-[11px] text-text-dim mt-1">
                  Read-only. Fetches a snapshot from the cloud. No Python or
                  project folder required.
                </div>
              </button>
              <button
                onClick={() => void setMode("operator")}
                className={`text-left p-4 rounded border transition-colors ${
                  mode === "operator"
                    ? "border-green/60 bg-green/5"
                    : "border-white/[0.08] hover:border-white/[0.2]"
                }`}
              >
                <div className="text-sm font-semibold text-white">Operator</div>
                <div className="text-[11px] text-text-dim mt-1">
                  Full local agent. Runs the Python pipeline, edits competitor
                  folders, manages tokens. Needs Python 3.10+ + project folder.
                </div>
              </button>
            </div>

            {mode === "viewer" && (
              <div>
                <label className="block text-xs text-text-dim mb-1.5 tracking-wider uppercase">
                  Snapshot URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={snapshotUrlDraft}
                    onChange={(e) => setSnapshotUrlDraft(e.target.value)}
                    placeholder="https://drive.google.com/uc?export=download&id=…"
                    className="flex-1 bg-white/[0.04] border border-white/[0.1] rounded px-3 py-2 text-sm text-text font-mono placeholder-text-dim/50 focus:outline-none focus:border-cyan/50"
                  />
                  <button
                    onClick={() => void setSnapshotUrl(snapshotUrlDraft.trim())}
                    disabled={snapshotUrlDraft === snapshotUrl}
                    className="text-xs px-4 py-2 rounded border border-cyan/40 text-cyan hover:bg-cyan/10 transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                <p className="text-[11px] text-text-dim mt-1.5">
                  Get this URL from your Compintel admin. Updated daily.
                </p>
              </div>
            )}

            {mode === "operator" && (
              <div>
                <label className="block text-xs text-text-dim mb-1.5 tracking-wider uppercase">
                  Project folder
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-3 py-2 text-[11px] text-text font-mono truncate">
                    {projectFolder || "not configured"}
                  </code>
                  <button
                    onClick={() => void pickProjectFolder()}
                    className="text-xs px-3 py-2 rounded border border-cyan/30 text-cyan hover:bg-cyan/10 transition"
                  >
                    Pick…
                  </button>
                  <button
                    onClick={() => void useDefaultProjectFolder()}
                    className="text-xs px-3 py-2 rounded border border-white/[0.1] text-text-dim hover:text-text hover:border-white/[0.2] transition"
                  >
                    Use default
                  </button>
                </div>
                <p className="text-[11px] text-text-dim mt-1.5">
                  Path to your local "Compitior Analysis" folder. Required so
                  the app can spawn run_agent.py and read tracking lists.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Operator-only sections — local agent state */}
        {mode === "viewer" && (
          <Card title="Viewer Mode" accent="cyan">
            <p className="text-sm text-text-dim">
              You're in read-only viewer mode. Data is pulled from a daily
              snapshot. Switch to Operator mode above if you need to run the
              agent or edit competitor folders locally.
            </p>
          </Card>
        )}

        {mode === "operator" && error && (
          <Card title="Error" accent="red">
            <p className="text-sm text-red">{error}</p>
          </Card>
        )}

        {mode === "operator" && env && (
          <>
        <Card title="OAuth & Credentials" accent={tokenWarn ? "yellow" : "cyan"}>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-text">token.json</div>
                <div className="text-[11px] text-text-dim">Gmail + Sheets + GSC + Drive scopes</div>
              </div>
              <div className="flex items-center gap-2">
                {env.tokenFileExists ? (
                  <>
                    <Pill variant={tokenWarn ? "yellow" : "green"}>{env.tokenAgeDays} days old</Pill>
                    {tokenWarn && (
                      <span className="text-[11px] text-yellow">
                        re-run auth_setup.py soon
                      </span>
                    )}
                  </>
                ) : (
                  <Pill variant="red">missing</Pill>
                )}
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-text">GITHUB_TOKEN in .env</div>
              <Pill variant={env.hasGithubToken ? "green" : "red"}>
                {env.hasGithubToken ? "set" : "missing"}
              </Pill>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-text">TAVILY_API_KEY in .env</div>
              <Pill variant={env.hasTavilyKey ? "green" : "red"}>
                {env.hasTavilyKey ? "set" : "missing"}
              </Pill>
            </div>
            <div className="flex items-baseline justify-between">
              <div className="text-sm text-text">SHEETS_ID in .env</div>
              <Pill variant={env.hasSheetsId ? "green" : "yellow"}>
                {env.hasSheetsId ? "set" : "auto-set on first run"}
              </Pill>
            </div>
          </div>
        </Card>

        <Card title="Scheduled Jobs" accent={env.launchdDailyExists && env.launchdWeeklyExists ? "green" : "yellow"}>
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-text">Daily agent</div>
                <div className="text-[11px] text-text-dim">8 AM IST · weekdays</div>
              </div>
              <Pill variant={env.launchdDailyExists ? "green" : "red"}>
                {env.launchdDailyExists ? "installed" : "not installed"}
              </Pill>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-text">Weekly digest</div>
                <div className="text-[11px] text-text-dim">Friday 5 PM IST</div>
              </div>
              <Pill variant={env.launchdWeeklyExists ? "green" : "red"}>
                {env.launchdWeeklyExists ? "installed" : "not installed"}
              </Pill>
            </div>
          </div>
        </Card>

        <Card title="Paths">
          <PathRow label="Agent root" path={env.agentRoot} exists />
          <PathRow label="Scripts directory" path={env.scriptsDir} exists />
        </Card>

        <Card title="Live Logs" accent="cyan">
          <p className="text-[12px] text-text-dim mb-3">
            Tail <code className="text-cyan">/tmp/nowgg-agent.log</code> (daily 8 AM IST run)
            and <code className="text-cyan">/tmp/nowgg-weekly-digest.log</code> (Friday 5 PM IST digest).
            Last 50 KB of each file is shown on start; new lines stream in as the agent writes.
          </p>
          <div className="space-y-3">
            <LogTail channel="daily"  title="Daily agent log (/tmp/nowgg-agent.log)" />
            <LogTail channel="weekly" title="Weekly digest log (/tmp/nowgg-weekly-digest.log)" />
          </div>
        </Card>

          </>
        )}

        <Card title="About">
          <div className="text-sm text-text-dim space-y-1">
            <div className="text-text font-semibold">Compintel — v0.2.0</div>
            <div>Competitive intelligence desktop app for now.gg</div>
            <div>Built with Tauri 2 · React 19 · TypeScript · Framer Motion · Tailwind</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
