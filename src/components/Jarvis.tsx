import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameState, LogLine, StepState } from "../store/runStore";
import { SPRING_SOFT } from "../lib/motion";

// Re-export the new SVG-based ring from its own file
export { JarvisRing } from "./JarvisRing";

// ── Step Flow ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  pending: { fg: "#6a8aaa", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.1)" },
  active:  { fg: "#00c8ff", bg: "rgba(0,200,255,0.12)",   border: "rgba(0,200,255,0.6)" },
  done:    { fg: "#00e87a", bg: "rgba(0,232,122,0.1)",    border: "rgba(0,232,122,0.5)" },
  failed:  { fg: "#ff4444", bg: "rgba(255,68,68,0.1)",    border: "rgba(255,68,68,0.5)" },
  skipped: { fg: "#6a8aaa", bg: "rgba(255,255,255,0.03)", border: "rgba(255,255,255,0.08)" },
} as const;

const STEP_GLYPH: Record<number, string> = {
  1: "GSC", 2: "GAP", 3: "SRC", 4: "RPT", 5: "MAIL", 6: "MEM", 8: "SHT",
};

interface StepFlowProps {
  steps: StepState[];
}

export function StepFlow({ steps }: StepFlowProps) {
  return (
    <div className="flex items-center justify-center gap-2 flex-wrap">
      {steps.map((s, i) => {
        const c = STATUS_COLORS[s.status];
        const isActive = s.status === "active";
        return (
          <div key={s.step} className="flex items-center gap-2">
            <motion.div
              className="relative flex flex-col items-center"
              animate={isActive ? { y: [0, -2, 0] } : {}}
              transition={isActive ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : {}}
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-[10px] font-bold tracking-wider border-2 transition-all"
                style={{
                  color: c.fg,
                  background: c.bg,
                  borderColor: c.border,
                  boxShadow: isActive ? `0 0 16px ${c.fg}80` : "none",
                }}
              >
                {s.status === "done"
                  ? "✓"
                  : s.status === "failed"
                    ? "✕"
                    : s.status === "skipped"
                      ? "—"
                      : STEP_GLYPH[s.step] ?? s.step}
              </div>
              <div className="text-[9px] mt-1.5 text-text-dim uppercase tracking-wider">
                Part {s.step}
              </div>
            </motion.div>
            {i < steps.length - 1 && (
              <div className="w-6 h-px bg-white/10" />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Live Log Panel ───────────────────────────────────────────────────────────

interface LogProps {
  lines: LogLine[];
}

export function LiveLog({ lines }: LogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="glass border border-cyan/15 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-text-dim flex items-center justify-between">
        <span>Console Output</span>
        <span>{lines.length} lines</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed bg-[#030711]"
      >
        {lines.length === 0 ? (
          <div className="text-text-dim italic">Waiting for output…</div>
        ) : (
          lines.map((l) => (
            <div
              key={l.id}
              className={l.stream === "stderr" ? "text-red" : "text-text"}
            >
              <span className="text-text-dim mr-2">
                {new Date(l.tsMs).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              {l.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Game Card Strip ──────────────────────────────────────────────────────────

const GAME_BORDER = {
  confirmed:      { border: "#00e87a", glow: "rgba(0,232,122,0.4)" },
  "needs-review": { border: "#ffcc00", glow: "rgba(255,204,0,0.35)" },
  blocked:        { border: "#ff4444", glow: "rgba(255,68,68,0.25)" },
  investigating:  { border: "#00c8ff", glow: "rgba(0,200,255,0.4)" },
  skipped:        { border: "#6a8aaa", glow: "rgba(106,138,170,0.2)" },
};

const GAME_LABEL = {
  confirmed: "Deploy Ready",
  "needs-review": "Needs Review",
  blocked: "Blocked",
  investigating: "Investigating…",
  skipped: "Skipped",
};

interface GameStripProps {
  games: GameState[];
}

export function GameStrip({ games }: GameStripProps) {
  return (
    <div className="glass border border-cyan/15 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-text-dim flex items-center justify-between">
        <span>Games This Run</span>
        <span>{games.length}</span>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-3">
        {games.length === 0 ? (
          <div className="text-text-dim italic h-full flex items-center">
            No games investigated yet.
          </div>
        ) : (
          <div className="flex gap-3 h-full">
            <AnimatePresence initial={false}>
              {games.map((g) => {
                const c = GAME_BORDER[g.status];
                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, y: 14, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
                    transition={SPRING_SOFT}
                    className="flex-shrink-0 w-[200px] h-full rounded-lg p-3 bg-bg-2/60 border-l-4 flex flex-col gap-1"
                    style={{
                      borderLeftColor: c.border,
                      boxShadow: `0 0 12px ${c.glow}`,
                    }}
                  >
                    <div className="text-[9px] uppercase tracking-widest" style={{ color: c.border }}>
                      #{g.rank} · {GAME_LABEL[g.status]}
                    </div>
                    <div className="font-semibold text-sm text-white truncate" title={g.name}>
                      {g.name}
                    </div>
                    {g.volume > 0 && (
                      <div className="text-[11px] text-text-dim">
                        {g.volume.toLocaleString()}/mo
                      </div>
                    )}
                    {g.url && (
                      <a
                        href={g.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-cyan truncate hover:underline mt-auto"
                        title={g.url}
                      >
                        {g.url.replace(/^https?:\/\//, "").slice(0, 24)}
                      </a>
                    )}
                    {g.license && (
                      <div className="text-[10px] text-text-dim">
                        {g.license}
                        {typeof g.stars === "number" && g.stars > 0 && ` · ⭐${g.stars}`}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Elapsed Time Counter ─────────────────────────────────────────────────────

export function ElapsedTimer({ ms }: { ms: number }) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    <span className="font-mono text-2xl text-white tabular-nums tracking-wider">
      {pad(h)}:{pad(m)}:{pad(s)}
    </span>
  );
}
