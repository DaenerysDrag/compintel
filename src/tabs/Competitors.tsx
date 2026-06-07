import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ipc } from "../lib/ipc";
import type { Competitor } from "../lib/types";
import { Card, Pill } from "../components/Card";
import { useAgentData } from "../lib/useAgentData";
import { useSettingsStore } from "../store/settingsStore";

interface UploadState {
  status: "idle" | "uploading" | "success" | "error";
  message?: string;
}

function ageColor(days: number | null, warnThreshold: number): "green" | "yellow" | "red" {
  if (days == null) return "red";
  if (days > warnThreshold * 1.5) return "red";
  if (days > warnThreshold) return "yellow";
  return "green";
}

function CompetitorCard({
  c,
  onUploadComplete,
  isViewer,
}: {
  c: Competitor;
  onUploadComplete: () => void;
  isViewer: boolean;
}) {
  const accent = c.isExhausted ? "red" : c.hasGapAnalysis ? "green" : "yellow";
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });

  const investigated = c.counts.confirmed + c.counts.blocked + c.counts.needsReview;
  const total = c.gapSize ?? 0;
  const pct = total > 0 ? Math.round((investigated / total) * 100) : 0;

  const handleUpload = async () => {
    try {
      const selected = await ipc.pickXlsxFile();
      if (!selected) return; // user cancelled
      setUpload({ status: "uploading", message: "Copying file..." });
      const result = await ipc.uploadSimilarwebFile(selected, c.name);
      setUpload({
        status: "success",
        message: `Uploaded ${result.fileName} (${Math.round(result.bytes / 1024)} KB)`,
      });
      // Refresh the list so the new file age + presence shows up.
      onUploadComplete();
      // Auto-dismiss the success state after 3 s.
      setTimeout(() => setUpload({ status: "idle" }), 3000);
    } catch (err) {
      setUpload({ status: "error", message: String(err) });
    }
  };

  return (
    <Card accent={accent}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-lg font-bold text-white">{c.name}</div>
          <div className="text-xs text-text-dim">{c.slug}</div>
        </div>
        {c.isExhausted ? (
          <Pill variant="red">Exhausted</Pill>
        ) : c.hasGapAnalysis ? (
          <Pill variant="green">Active</Pill>
        ) : (
          <Pill variant="yellow">Needs setup</Pill>
        )}
      </div>

      {/* SimilarWeb file */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">SimilarWeb file</div>
        {c.hasSimilarwebFile ? (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text truncate max-w-[60%]" title={c.similarwebFileName ?? ""}>
              {c.similarwebFileName}
            </span>
            <Pill variant={ageColor(c.similarwebAgeDays, 60)}>{c.similarwebAgeDays} days old</Pill>
          </div>
        ) : (
          <Pill variant="red">Not present — drop a .xlsx into the folder</Pill>
        )}
      </div>

      {/* Gap analysis age */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Latest gap analysis</div>
        {c.hasGapAnalysis ? (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text">
              {c.gapSize ?? 0} games
            </span>
            <Pill variant={ageColor(c.gapAnalysisAgeDays, 14)}>{c.gapAnalysisAgeDays} days old</Pill>
          </div>
        ) : (
          <Pill variant="yellow">Not generated yet</Pill>
        )}
      </div>

      {/* Investigation breakdown */}
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-widest text-text-dim mb-2">Investigation</div>
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-xs text-text-dim">
            {investigated} / {total || "—"} investigated
          </span>
          <span className="text-xs text-text-dim">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden mb-2">
          <motion.div
            className={`h-full ${c.isExhausted ? "bg-red/70" : pct > 70 ? "bg-yellow/70" : "bg-green/70"}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <Pill variant="green">✅ {c.counts.confirmed}</Pill>
          <Pill variant="yellow">⚠️ {c.counts.needsReview}</Pill>
          <Pill variant="red">❌ {c.counts.blocked}</Pill>
          {c.counts.alreadyOnNowgg > 0 && (
            <Pill variant="cyan">🔄 {c.counts.alreadyOnNowgg}</Pill>
          )}
        </div>
      </div>

      {/* Operator-only actions. Viewer mode has no local folder + no API to mutate. */}
      {!isViewer && (
        <div className="flex gap-2 pt-3 border-t border-white/5 flex-wrap">
          {c.folder && (
            <button
              onClick={() => ipc.openPath(c.folder).catch(console.error)}
              className="text-xs px-3 py-1.5 rounded border border-cyan/30 text-cyan hover:bg-cyan/10 transition"
            >
              Open folder
            </button>
          )}
          <button
            onClick={handleUpload}
            disabled={upload.status === "uploading"}
            className={`text-xs px-3 py-1.5 rounded border transition ${
              upload.status === "uploading"
                ? "border-white/10 text-text-dim cursor-wait"
                : "border-purple/40 text-purple hover:bg-purple/10"
            }`}
          >
            {upload.status === "uploading" ? "Uploading…" : "Upload SimilarWeb file"}
          </button>
        </div>
      )}

      <AnimatePresence>
        {upload.status !== "idle" && upload.message && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-3 px-3 py-2 rounded text-[11px] border ${
              upload.status === "success"
                ? "border-green/30 bg-green/10 text-green"
                : upload.status === "error"
                  ? "border-red/30 bg-red/10 text-red"
                  : "border-cyan/30 bg-cyan/5 text-cyan"
            }`}
          >
            {upload.message}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Add-competitor inline form ────────────────────────────────────────────────

function AddCompetitorForm({
  onCreated,
  onCancel,
}: {
  onCreated: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror Rust validation so users see errors before clicking Create.
  const localError =
    name.length === 0
      ? null
      : name.length > 40
        ? "Maximum 40 characters."
        : !/^[A-Za-z0-9 ._-]+$/.test(name)
          ? "Only letters, digits, space, dot, underscore, hyphen."
          : name.trim() !== name
            ? "No leading or trailing whitespace."
            : null;

  const submit = async () => {
    if (localError || name.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await ipc.addCompetitor(name);
      onCreated(result.name);
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  };

  return (
    <Card accent="cyan" className="mb-4">
      <div className="text-[10px] uppercase tracking-widest text-cyan/80 mb-2">
        ADD NEW COMPETITOR
      </div>
      <div className="flex items-start gap-3">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          placeholder="e.g. Y8, CoolMathGames, GameDistribution"
          maxLength={40}
          disabled={submitting}
          className="flex-1 bg-bg-2 border border-cyan/20 rounded px-3 py-2 text-sm text-text outline-none focus:border-cyan/60 disabled:opacity-50"
        />
        <button
          onClick={submit}
          disabled={!!localError || name.length === 0 || submitting}
          className="px-4 py-2 rounded bg-cyan text-bg font-bold text-sm shadow-glow-cyan disabled:opacity-40 disabled:cursor-not-allowed hover:bg-cyan/90 transition"
        >
          {submitting ? "Creating…" : "Create"}
        </button>
        <button
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 rounded border border-white/15 text-text-dim text-sm hover:text-text hover:bg-white/[0.03] transition"
        >
          Cancel
        </button>
      </div>
      {localError && (
        <div className="mt-2 text-[11px] text-yellow">{localError}</div>
      )}
      {error && (
        <div className="mt-2 text-[11px] text-red">{error}</div>
      )}
      <div className="mt-3 text-[11px] text-text-dim leading-relaxed">
        Creates <code className="text-cyan">{name || "<name>"} vs Now.gg/</code> with empty tracking
        list + <code>Gap Analysis/</code> + <code>Tech Handoff/</code> subfolders. After it appears,
        click <strong>Upload SimilarWeb file</strong> on the new card to drop the <code>.xlsx</code>,
        then run the agent.
      </div>
    </Card>
  );
}

// ── Top-level Competitors tab ─────────────────────────────────────────────────

export default function Competitors() {
  const { competitors, loading, error, fromCache, refresh } = useAgentData();
  const mode = useSettingsStore((s) => s.mode);
  const isViewer = mode === "viewer";
  const [adding, setAdding] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);

  if (loading && competitors.length === 0) {
    return <div className="text-text-dim">Loading…</div>;
  }
  if (error && competitors.length === 0) {
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

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Competitors</h1>
          <p className="text-sm text-text-dim mt-1">
            {competitors.length} competitor{competitors.length === 1 ? "" : "s"}
            {isViewer && " · viewer mode (read-only)"}
            {isViewer && fromCache && (
              <span className="ml-2 text-yellow">· showing cached snapshot</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refresh()}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded border border-cyan/30 text-cyan hover:bg-cyan/5 transition-colors disabled:opacity-40"
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          {/* Add Competitor mutates the local filesystem — hidden in viewer mode. */}
          {!isViewer && !adding && (
            <button
              onClick={() => setAdding(true)}
              className="px-4 py-2 rounded-lg bg-cyan/10 border border-cyan/40 text-cyan text-sm font-semibold hover:bg-cyan/20 transition shadow-glow-cyan"
            >
              + Add Competitor
            </button>
          )}
        </div>
      </div>

      {/* Inline add-competitor form — operator only */}
      <AnimatePresence>
        {!isViewer && adding && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.18 }}
          >
            <AddCompetitorForm
              onCreated={(name) => {
                setAdding(false);
                setJustCreated(name);
                void refresh();
                setTimeout(() => setJustCreated(null), 4000);
              }}
              onCancel={() => setAdding(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Just-created banner */}
      <AnimatePresence>
        {justCreated && !adding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mb-4 px-4 py-3 rounded-lg border border-green/30 bg-green/5 text-green text-sm"
          >
            ✓ Created <strong>{justCreated} vs Now.gg/</strong> — the card below now has an{" "}
            <strong>Upload SimilarWeb file</strong> button.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-2 gap-4">
        {competitors.map((c) => (
          <CompetitorCard
            key={c.slug}
            c={c}
            isViewer={isViewer}
            onUploadComplete={() => void refresh()}
          />
        ))}
      </div>

      {competitors.length === 0 && (
        <Card accent="yellow">
          <div className="text-center py-8 text-text-dim">
            <div className="text-lg mb-1">No competitors yet</div>
            <div className="text-sm">
              {isViewer
                ? "The snapshot is empty — confirm the agent has run today or check the snapshot URL in Settings."
                : <>Run <code className="bg-bg-2 px-1.5 py-0.5 rounded text-cyan">python3 run_agent.py --competitor "Name"</code> to create the first competitor folder.</>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
