import { motion } from "framer-motion";
import { Card, Stat, Pill } from "../components/Card";
import { useAgentData } from "../lib/useAgentData";
import { useSettingsStore } from "../store/settingsStore";

function BacklogBar({ remaining, gapSize }: { remaining: number | null; gapSize: number | null }) {
  if (gapSize == null || gapSize === 0 || remaining == null) {
    return <div className="text-text-dim text-xs">no gap analysis yet</div>;
  }
  const investigated = gapSize - remaining;
  const pct = Math.min(100, Math.round((investigated / gapSize) * 100));
  const colour =
    remaining === 0 ? "bg-red/70" : pct > 90 ? "bg-red/70" : pct > 70 ? "bg-yellow/70" : "bg-green/70";
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-text-dim">{investigated} / {gapSize} investigated</span>
        <span className="text-xs text-text-dim">{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${colour}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { summary, competitors, env, loading, error, fromCache, refresh } = useAgentData();
  const mode = useSettingsStore((s) => s.mode);

  if (loading && !summary) {
    return <div className="text-text-dim">Loading…</div>;
  }
  if (error && !summary) {
    return (
      <div className="text-red">
        Error: {error}
        <button
          onClick={() => void refresh()}
          className="ml-3 underline text-cyan text-sm"
        >
          retry
        </button>
      </div>
    );
  }

  const totalConfirmed = summary?.totalConfirmed ?? 0;
  const totalBlocked = summary?.totalBlocked ?? 0;
  const activeCount = competitors.filter((c) => !c.isExhausted && c.hasGapAnalysis).length;

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-text-dim mt-1">
            Pipeline health and lifetime stats.
            {mode === "viewer" && fromCache && (
              <span className="ml-2 text-yellow">· showing cached snapshot</span>
            )}
            {mode === "viewer" && error && !fromCache && (
              <span className="ml-2 text-red">· {error}</span>
            )}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded border border-cyan/30 text-cyan hover:bg-cyan/5 transition-colors disabled:opacity-40"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {/* Top stats strip */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card accent="green">
          <Stat label="Total ✅ Confirmed" value={totalConfirmed} accent="green" sub="all competitors, all time" />
        </Card>
        <Card accent="red">
          <Stat label="Total ❌ Blocked" value={totalBlocked} accent="red" sub="all competitors, all time" />
        </Card>
        <Card accent="cyan">
          <Stat label="Active Competitors" value={activeCount} accent="cyan" sub={`${competitors.length} total`} />
        </Card>
        <Card accent="yellow">
          <Stat
            label="Last Run"
            value={summary?.date ?? "—"}
            sub={summary?.time ? `at ${summary.time} IST` : undefined}
          />
        </Card>
      </div>

      {/* Last run details */}
      <Card title="Last Run Summary" accent="cyan" className="mb-6">
        {summary?.date ? (
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <span className="text-text-dim">Competitor:</span>{" "}
              <span className="text-white font-semibold">{summary.competitor ?? "—"}</span>
            </div>
            <div>
              <span className="text-text-dim">Next game:</span>{" "}
              <span className="text-text">{summary.nextGame ?? "—"}</span>
            </div>
            <div>
              <span className="text-text-dim">Investigated:</span>{" "}
              <span className="text-text">{summary.investigated ?? 0}</span>
            </div>
            <div>
              <span className="text-text-dim">Remaining:</span>{" "}
              <span className="text-text">{summary.remaining ?? 0}</span>
            </div>
            <div>
              <span className="text-text-dim">Found today:</span>{" "}
              <span className="text-green font-semibold">✅ {summary.found ?? 0}</span>
            </div>
            <div>
              <span className="text-text-dim">Blocked today:</span>{" "}
              <span className="text-red font-semibold">❌ {summary.blocked ?? 0}</span>
            </div>
          </div>
        ) : (
          <div className="text-text-dim">No run summary found in CLAUDE.md.</div>
        )}
      </Card>

      {/* Competitors backlog */}
      <Card title="Competitor Backlogs" className="mb-6">
        <div className="space-y-4">
          {competitors.map((c) => (
            <div key={c.slug} className="grid grid-cols-[1fr_2fr_auto] gap-4 items-center">
              <div>
                <div className="font-semibold text-white text-sm">{c.name}</div>
                <div className="flex gap-1.5 mt-1">
                  {c.counts.confirmed > 0 && <Pill variant="green">✅ {c.counts.confirmed}</Pill>}
                  {c.counts.needsReview > 0 && <Pill variant="yellow">⚠️ {c.counts.needsReview}</Pill>}
                  {c.counts.blocked > 0 && <Pill variant="red">❌ {c.counts.blocked}</Pill>}
                </div>
              </div>
              <BacklogBar remaining={c.remaining} gapSize={c.gapSize} />
              <div className="text-right">
                {c.isExhausted ? (
                  <Pill variant="red">Exhausted</Pill>
                ) : c.hasGapAnalysis ? (
                  <Pill variant="green">Active</Pill>
                ) : (
                  <Pill variant="yellow">Setup pending</Pill>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Health warnings — operator-only (viewer doesn't have access to local agent files) */}
      {mode === "operator" && (
      <Card title="Health Checks" accent={env && (
        !env.tokenFileExists ||
        (env.tokenAgeDays ?? 0) > 150 ||
        (env.nowggGamesCsvAgeDays ?? 0) > 30
      ) ? "yellow" : "green"}>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-dim">OAuth token</span>
            {env?.tokenFileExists ? (
              <Pill variant={(env.tokenAgeDays ?? 0) > 150 ? "yellow" : "green"}>
                {env.tokenAgeDays} days old
              </Pill>
            ) : (
              <Pill variant="red">missing</Pill>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim">nowgg-existing-games.csv</span>
            {env?.nowggGamesCsvExists ? (
              <Pill variant={(env.nowggGamesCsvAgeDays ?? 0) > 30 ? "yellow" : "green"}>
                {env.nowggGamesCsvAgeDays} days old
              </Pill>
            ) : (
              <Pill variant="red">missing</Pill>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim">GitHub token</span>
            <Pill variant={env?.hasGithubToken ? "green" : "red"}>
              {env?.hasGithubToken ? "set" : "missing"}
            </Pill>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim">Tavily API key</span>
            <Pill variant={env?.hasTavilyKey ? "green" : "red"}>
              {env?.hasTavilyKey ? "set" : "missing"}
            </Pill>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim">Sheets ID</span>
            <Pill variant={env?.hasSheetsId ? "green" : "yellow"}>
              {env?.hasSheetsId ? "set" : "not set"}
            </Pill>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-dim">launchd daily job</span>
            <Pill variant={env?.launchdDailyExists ? "green" : "red"}>
              {env?.launchdDailyExists ? "installed" : "missing"}
            </Pill>
          </div>
        </div>
      </Card>
      )}
    </div>
  );
}
