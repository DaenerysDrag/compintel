import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ipc } from "../lib/ipc";
import type { Competitor } from "../lib/types";
import { Card, Pill } from "../components/Card";
import {
  ElapsedTimer,
  GameStrip,
  JarvisRing,
  LiveLog,
  StepFlow,
} from "../components/Jarvis";
import { selectCounts, selectElapsedMs, useRunStore } from "../store/runStore";
import { SPRING_SOFT } from "../lib/motion";

// ── Idle screen ─────────────────────────────────────────────────────────────

function IdleScreen({ competitors }: { competitors: Competitor[] }) {
  const start     = useRunStore((s) => s.start);
  const startDemo = useRunStore((s) => s.startDemo);
  const [chosen, setChosen] = useState<string>("");

  // Weekend warning — the agent's run_agent.py skips Sat/Sun unless --competitor is passed.
  const day = new Date().getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = day === 0 || day === 6;
  const wouldSkip = isWeekend && !chosen;

  return (
    <div className="h-full flex items-center justify-center">
      <Card accent="cyan" className="w-[520px]">
        <div className="text-center mb-6">
          <div className="text-[10px] tracking-widest text-cyan/80 mb-1">READY TO RUN</div>
          <h2 className="text-2xl font-bold text-white">Launch agent pipeline</h2>
          <p className="text-sm text-text-dim mt-2">
            Runs the same command launchd fires at 8 AM IST daily — nothing in the agent changes.
          </p>
        </div>

        {isWeekend && (
          <div className="mb-5 px-4 py-3 rounded-lg border border-yellow/30 bg-yellow/5">
            <div className="text-[11px] uppercase tracking-widest text-yellow mb-1">
              ⚠ Weekend detected
            </div>
            <div className="text-[12px] text-text-dim leading-relaxed">
              The agent's <code className="text-yellow">run_agent.py</code> skips Saturday + Sunday by default to match the org's "no-Friday-merge / weekend-off" policy. To run on a weekend you must <strong className="text-text">pick a competitor below</strong> — that forces the <code>--competitor</code> flag which bypasses the skip.
            </div>
          </div>
        )}

        <div className="mb-6">
          <label className="block text-[10px] uppercase tracking-widest text-text-dim mb-2">
            Competitor {isWeekend ? "(required on weekends)" : "(optional)"}
          </label>
          <select
            value={chosen}
            onChange={(e) => setChosen(e.target.value)}
            className={`w-full bg-bg-2 border rounded px-3 py-2 text-sm text-text outline-none focus:border-cyan/60 ${
              wouldSkip ? "border-yellow/40" : "border-cyan/20"
            }`}
          >
            <option value="">All competitors (default)</option>
            {competitors.map((c) => (
              <option key={c.slug} value={c.name}>
                {c.name} {c.isExhausted ? "(exhausted)" : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-text-dim mt-2">
            Leave blank to run the same pipeline launchd uses. Pick a competitor to force-target.
          </p>
        </div>

        <button
          onClick={() => start(chosen || null)}
          className={`w-full py-3 rounded-lg font-bold text-sm tracking-wide transition ${
            wouldSkip
              ? "bg-yellow/20 text-yellow border border-yellow/30 cursor-pointer hover:bg-yellow/30"
              : "bg-cyan text-bg shadow-glow-cyan hover:bg-cyan/90"
          }`}
        >
          {wouldSkip ? "▶ Run Now (will be skipped — weekend)" : "▶ Run Now"}
        </button>

        <div className="mt-4 pt-4 border-t border-white/5 text-center">
          <button
            onClick={() => startDemo()}
            className="text-xs text-purple hover:text-purple/80 transition"
          >
            ◇ Try Demo Run (no APIs, scripted scenario)
          </button>
          <p className="text-[10px] text-text-dim mt-1">
            Streams a recorded scenario through the same UI. Safe to run anytime.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ── Running screen (the Jarvis HUD) ──────────────────────────────────────────

function RunningScreen() {
  const steps        = useRunStore((s) => s.steps);
  const currentStep  = useRunStore((s) => s.currentStep);
  const games        = useRunStore((s) => s.games);
  const logLines     = useRunStore((s) => s.logLines);
  const startedAt    = useRunStore((s) => s.startedAt);
  const finishedAt   = useRunStore((s) => s.finishedAt);
  const stop         = useRunStore((s) => s.stop);
  const isDemo       = useRunStore((s) => s.isDemo);

  // Tick once per second to refresh the timer.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = selectElapsedMs({ startedAt, finishedAt } as any);
  const counts = selectCounts({ games } as any);

  const active = steps.find((s) => s.status === "active");
  const failed = steps.some((s) => s.status === "failed");
  const centerLabel = active ? `Part ${active.step}` : (failed ? "Run failed" : "Initializing");
  const centerDetail = active?.detail ?? active?.label;
  // Compute-burst overlay fires on Part 3 (source hunting) — the heaviest phase
  const burstMode = active?.step === 3;

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-text-dim mb-0.5">Elapsed</div>
            <ElapsedTimer ms={elapsed} />
          </div>
          {isDemo && (
            <div className="px-2 py-1 rounded border border-purple/40 bg-purple/10 text-purple text-[10px] uppercase tracking-widest">
              ◇ Demo Mode
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Pill variant="green">✅ {counts.confirmed}</Pill>
          <Pill variant="yellow">⚠️ {counts.needsReview}</Pill>
          <Pill variant="red">❌ {counts.blocked}</Pill>
          <button
            onClick={stop}
            className="text-xs px-3 py-1.5 rounded border border-red/40 text-red hover:bg-red/10 transition"
          >
            Stop Run
          </button>
        </div>
      </div>

      {/* Step flow strip */}
      <div className="py-2">
        <StepFlow steps={steps} />
      </div>

      {/* Center: ring + live log side by side */}
      <div className="flex-1 grid grid-cols-[1fr_1fr] gap-4 min-h-0">
        <div className="glass border border-cyan/15 rounded-lg flex flex-col items-center justify-center p-6">
          <JarvisRing
            active={!!active}
            failed={failed}
            centerLabel={centerLabel}
            centerDetail={centerDetail}
            burstMode={burstMode}
          />
          <div className="mt-6 text-center">
            <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">
              Current step
            </div>
            <div className="text-sm text-white">
              {currentStep ? `Part ${currentStep}: ${active?.label ?? "…"}` : "Waiting…"}
            </div>
          </div>
        </div>

        <LiveLog lines={logLines} />
      </div>

      {/* Bottom: game cards */}
      <div className="h-[160px] flex-shrink-0">
        <GameStrip games={games} />
      </div>
    </div>
  );
}

// ── Done screen ─────────────────────────────────────────────────────────────

function DoneScreen() {
  const reset      = useRunStore((s) => s.reset);
  const exitCode   = useRunStore((s) => s.exitCode);
  const startedAt  = useRunStore((s) => s.startedAt);
  const finishedAt = useRunStore((s) => s.finishedAt);
  const games      = useRunStore((s) => s.games);
  const error      = useRunStore((s) => s.errorMessage);
  const logLines   = useRunStore((s) => s.logLines);
  const steps      = useRunStore((s) => s.steps);

  const counts = selectCounts({ games } as any);
  const success = exitCode === 0;
  const elapsedMs = (finishedAt ?? Date.now()) - (startedAt ?? Date.now());

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <Card accent={success ? "green" : "red"}>
        <div className="text-center py-2">
          <div className="text-[10px] uppercase tracking-widest mb-2" style={{
            color: success ? "#00e87a" : "#ff4444",
          }}>
            {success ? "Run Complete" : "Run Failed"}
          </div>
          {error && (
            <div className="text-sm text-red mb-3">{error}</div>
          )}
          <div className="text-5xl font-bold text-white mb-1">
            <span className="text-green">{counts.confirmed}</span>
            <span className="text-text-dim text-xl mx-2">·</span>
            <span className="text-yellow">{counts.needsReview}</span>
            <span className="text-text-dim text-xl mx-2">·</span>
            <span className="text-red">{counts.blocked}</span>
          </div>
          <div className="text-sm text-text-dim mt-2">
            confirmed · needs review · blocked
          </div>
          <div className="text-[11px] text-text-dim mt-2">
            Total {games.length} games investigated in {Math.round(elapsedMs / 1000)}s
            {exitCode !== null && ` · exit ${exitCode}`}
          </div>
        </div>
      </Card>

      <div className="flex-1 grid grid-cols-[1fr_1fr] gap-4 min-h-0">
        <div className="glass border border-cyan/15 rounded-lg p-4 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-widest text-text-dim mb-3">Step Summary</div>
          <div className="space-y-2">
            {steps.map((s) => (
              <div key={s.step} className="flex items-center justify-between text-sm">
                <span className="text-text">Part {s.step}: {s.label}</span>
                <Pill variant={
                  s.status === "done" ? "green" :
                  s.status === "failed" ? "red" :
                  s.status === "skipped" ? "default" :
                  "yellow"
                }>
                  {s.status}
                </Pill>
              </div>
            ))}
          </div>
        </div>
        <LiveLog lines={logLines.slice(-50)} />
      </div>

      <div className="flex gap-3 justify-center pt-2 flex-shrink-0">
        <button
          onClick={reset}
          className="px-5 py-2 rounded bg-cyan text-bg font-bold text-sm shadow-glow-cyan hover:bg-cyan/90 transition"
        >
          Run Again
        </button>
      </div>
    </div>
  );
}

// ── Top-level ───────────────────────────────────────────────────────────────

export default function RunAgent() {
  const running = useRunStore((s) => s.running);
  const done = useRunStore((s) => s.done);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);

  useEffect(() => {
    ipc.listCompetitors().then(setCompetitors).catch(console.error);
  }, []);

  let phase: "idle" | "running" | "done" = "idle";
  if (running) phase = "running";
  else if (done) phase = "done";

  return (
    <div className="h-full overflow-hidden">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Run Agent</h1>
        <p className="text-sm text-text-dim mt-1">
          {phase === "idle" && "Pick a competitor and trigger a run."}
          {phase === "running" && "Live pipeline execution — same as the daily 8 AM IST job."}
          {phase === "done" && "Run complete. Review results below."}
        </p>
      </div>

      <div className="h-[calc(100%-72px)]">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_SOFT}
            className="h-full"
          >
            {phase === "idle"    && <IdleScreen competitors={competitors} />}
            {phase === "running" && <RunningScreen />}
            {phase === "done"    && <DoneScreen />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
