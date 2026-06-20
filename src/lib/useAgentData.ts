// Unified data hook — returns the same shape regardless of viewer/operator mode.
//
// Operator mode: reads from local filesystem via Tauri commands.
// Viewer mode:   reads from the snapshot store (cloud JSON).
//
// Both modes return the same TS shapes (LastRunSummary, Competitor, RunLogRow,
// EnvStatus) so tabs don't need to special-case rendering by mode.

import { useEffect, useState } from "react";
import { ipc } from "./ipc";
import type { Competitor, EnvStatus, LastRunSummary, RunLogRow } from "./types";
import { useSettingsStore } from "../store/settingsStore";
import { useSnapshotStore } from "../store/snapshotStore";

interface AgentData {
  summary: LastRunSummary | null;
  competitors: Competitor[];
  runLog: RunLogRow[];
  env: EnvStatus | null;
  loading: boolean;
  error: string | null;
  /** ISO timestamp the snapshot was generated (viewer mode); null in operator mode. */
  generatedAt: string | null;
  /** True in viewer mode + snapshot data is from the offline cache. */
  fromCache: boolean;
  /** Refetch — viewer mode re-pulls from snapshot URL, operator re-reads disk. */
  refresh: () => Promise<void>;
}

const EMPTY_COUNTS = { confirmed: 0, blocked: 0, needsReview: 0, alreadyOnNowgg: 0 };

/** Empty EnvStatus placeholder for viewer mode (no local agent). */
const EMPTY_ENV: EnvStatus = {
  scriptsDir: "",
  agentRoot: "",
  tokenFileExists: false,
  tokenAgeDays: null,
  envFileExists: false,
  hasGithubToken: false,
  hasTavilyKey: false,
  hasSheetsId: false,
  nowggGamesCsvExists: false,
  nowggGamesCsvAgeDays: null,
  launchdDailyExists: false,
  launchdWeeklyExists: false,
};

export function useAgentData(): AgentData {
  const mode = useSettingsStore((s) => s.mode);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const snapshotUrl = useSettingsStore((s) => s.snapshotUrl);
  const snapshot = useSnapshotStore((s) => s.data);
  const snapshotLoading = useSnapshotStore((s) => s.loading);
  const snapshotError = useSnapshotStore((s) => s.error);
  const snapshotFromCache = useSnapshotStore((s) => s.fromCache);
  const loadSnapshot = useSnapshotStore((s) => s.load);

  const [opSummary, setOpSummary] = useState<LastRunSummary | null>(null);
  const [opCompetitors, setOpCompetitors] = useState<Competitor[]>([]);
  const [opRunLog, setOpRunLog] = useState<RunLogRow[]>([]);
  const [opEnv, setOpEnv] = useState<EnvStatus | null>(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const loadOperator = async () => {
    setOpLoading(true);
    setOpError(null);
    try {
      const [s, c, l, e] = await Promise.all([
        ipc.readLastRunSummary(),
        ipc.listCompetitors(),
        ipc.readRunLog(),
        ipc.readEnvStatus(),
      ]);
      setOpSummary(s);
      setOpCompetitors(c);
      setOpRunLog(l);
      setOpEnv(e);
    } catch (err) {
      setOpError(String(err));
    } finally {
      setOpLoading(false);
    }
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    if (mode === "operator") {
      void loadOperator();
    }
  }, [settingsLoaded, mode]);

  if (mode === "viewer") {
    // Map snapshot → unified shapes. Snapshot competitors already match the
    // Competitor TS shape (camelCase keys), but the snapshot version has a
    // narrower field set; we fill in defaults.
    const competitors: Competitor[] = (snapshot?.competitors ?? []).map((c) => ({
      name: c.name,
      slug: c.slug,
      folder: "",                              // not exposed in viewer
      counts: c.counts ?? EMPTY_COUNTS,
      gapSize: c.gapSize,
      remaining: c.remaining,
      isExhausted: c.isExhausted,
      hasSimilarwebFile: !!c.similarwebFile,
      similarwebFileName: c.similarwebFile ?? null,
      similarwebAgeDays: c.similarwebAgeDays,
      hasGapAnalysis: c.gapSize != null,
      gapAnalysisAgeDays: null,
    }));
    return {
      summary: snapshot
        ? {
            date: snapshot.summary.date ?? null,
            time: snapshot.summary.time ?? null,
            competitor: snapshot.summary.competitor ?? null,
            investigated: snapshot.summary.investigated ?? null,
            found: snapshot.summary.found ?? null,
            blocked: snapshot.summary.blocked ?? null,
            nextGame: snapshot.summary.nextGame ?? null,
            totalConfirmed: snapshot.summary.totalConfirmed ?? null,
            totalBlocked: snapshot.summary.totalBlocked ?? null,
            remaining: snapshot.summary.remaining ?? null,
          }
        : null,
      competitors,
      // Snapshot rows don't include the `raw` debug line — synthesize one so
      // History tab's "show raw" toggle still works.
      runLog: (snapshot?.runLog ?? []).map((r) => ({
        ...r,
        raw: `| ${r.date} | ${r.competitor} | ${r.investigated} | ${r.found} | ${r.blocked} | ${r.emailStatus} |`,
      })),
      env: EMPTY_ENV,
      loading: snapshotLoading,
      error: snapshotError,
      generatedAt: snapshot?.generatedAt ?? null,
      fromCache: snapshotFromCache,
      refresh: async () => {
        await loadSnapshot(snapshotUrl);
      },
    };
  }

  return {
    summary: opSummary,
    competitors: opCompetitors,
    runLog: opRunLog,
    env: opEnv,
    loading: opLoading,
    error: opError,
    generatedAt: null,
    fromCache: false,
    refresh: loadOperator,
  };
}
