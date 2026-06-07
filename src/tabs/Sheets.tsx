import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ipc } from "../lib/ipc";
import type { Competitor, EnvStatus } from "../lib/types";
import { Card, Pill } from "../components/Card";

// Karan's master sheet — same one the agent writes to. Hardcoded for V1.
// (V2 idea: read this from Agent/Scripts/.env via a new Rust command.)
const SHEETS_ID = "1KjxTyTp-ZufjjZ9uuxqA-9ZDDd16iCGEF7VqOCkCRfs";
const SHEET_BASE = `https://docs.google.com/spreadsheets/d/${SHEETS_ID}`;

// Why no iframe? Google explicitly blocks embedding private Sheets in cross-origin
// frames (X-Frame-Options + cookie isolation). The Tauri webview doesn't carry
// the user's Google session cookies, so the iframe just shows "Can't access your
// Google Account". Opening in the user's default browser uses their existing
// Google login. That's the actually-works UX.

function openInBrowser(url: string) {
  // Tauri's opener plugin routes URLs through the OS so they open in the user's
  // default browser (where they're already logged into Google). `window.open`
  // would either be blocked by Tauri or open inside the webview without cookies.
  ipc.openUrl(url).catch(console.error);
}

export default function Sheets() {
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([ipc.readEnvStatus(), ipc.listCompetitors()])
      .then(([e, c]) => {
        setEnv(e);
        setCompetitors(c);
      })
      .catch((err) => setError(String(err)));
  }, []);

  if (error) return <div className="text-red">Error: {error}</div>;
  if (!env)  return <div className="text-text-dim">Loading…</div>;

  const totalConfirmed = competitors.reduce((s, c) => s + c.counts.confirmed, 0);
  const totalReview    = competitors.reduce((s, c) => s + c.counts.needsReview, 0);
  const totalBlocked   = competitors.reduce((s, c) => s + c.counts.blocked, 0);

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Sheets</h1>
        <p className="text-sm text-text-dim mt-1">
          Master spreadsheet — one tab per competitor, rows accumulate across runs.
        </p>
      </div>

      {/* Hero card — primary action */}
      <Card accent="green" className="mb-6">
        <div className="flex items-start gap-5">
          <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-green/15 border border-green/30 flex items-center justify-center text-2xl">
            ▤
          </div>
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-widest text-green/80 mb-1">
              MASTER SHEET
            </div>
            <h2 className="text-xl font-bold text-white mb-1">
              now.gg Competitor Analysis — Game Pipeline
            </h2>
            <div className="text-[11px] text-text-dim font-mono mb-4">
              ID: {SHEETS_ID}
            </div>

            <div className="flex flex-wrap gap-3 mb-4">
              {env.hasSheetsId ? (
                <Pill variant="green">✓ SHEETS_ID set in .env</Pill>
              ) : (
                <Pill variant="yellow">⚠ SHEETS_ID not in .env</Pill>
              )}
              <Pill variant="cyan">{competitors.length} competitor tabs</Pill>
              <Pill variant="green">✅ {totalConfirmed} confirmed</Pill>
              <Pill variant="yellow">⚠️ {totalReview} review</Pill>
              <Pill variant="red">❌ {totalBlocked} blocked</Pill>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openInBrowser(`${SHEET_BASE}/edit`)}
              className="px-5 py-2.5 rounded-lg bg-green text-bg font-bold text-sm shadow-glow-green hover:bg-green/90 transition"
            >
              ▤ Open Sheet in Browser ↗
            </motion.button>
          </div>
        </div>
      </Card>

      {/* Per-competitor quick-links */}
      <Card title="Jump to a Competitor Tab" className="mb-6">
        <p className="text-[12px] text-text-dim mb-4">
          Each competitor has its own tab in the sheet. Click any card below to open the
          sheet directly to that tab (uses your logged-in Google browser session).
        </p>
        <div className="grid grid-cols-2 gap-3">
          {competitors.map((c) => {
            const status =
              c.isExhausted ? "Exhausted" :
              c.hasGapAnalysis ? "Active" :
              "Setup pending";
            const statusVariant =
              c.isExhausted ? "red" :
              c.hasGapAnalysis ? "green" :
              "yellow";
            return (
              <motion.button
                key={c.slug}
                whileHover={{ y: -2 }}
                onClick={() => openInBrowser(`${SHEET_BASE}/edit#gid=0&fvid=0`)}
                className="text-left p-4 rounded-lg border border-cyan/20 bg-bg-2/40 hover:bg-bg-2/70 hover:border-cyan/40 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="font-semibold text-white">{c.name}</div>
                  <Pill variant={statusVariant as any}>{status}</Pill>
                </div>
                <div className="flex gap-2 text-[11px]">
                  <span className="text-green">✅ {c.counts.confirmed}</span>
                  <span className="text-yellow">⚠️ {c.counts.needsReview}</span>
                  <span className="text-red">❌ {c.counts.blocked}</span>
                </div>
                <div className="text-[10px] text-text-dim mt-2 group-hover:text-cyan transition">
                  Open in browser ↗
                </div>
              </motion.button>
            );
          })}
        </div>
      </Card>

      {/* Why no inline embed */}
      <Card title="Why does this open in a browser?" accent="cyan">
        <div className="text-[12px] text-text-dim leading-relaxed space-y-2">
          <p>
            Google Sheets blocks embedding private documents inside other apps because
            the embedded view doesn't have access to your Google login cookies. Opening
            in your default browser uses your existing Google session — no re-auth,
            no permission errors, full editing capability.
          </p>
          <p className="text-[11px] text-text-dim/70">
            (If you ever want a true in-app view, we'd need to either publish the sheet
            to the web or build a custom read-only view that uses the Sheets API.
            Neither is worth the complexity for an internal tool.)
          </p>
        </div>
      </Card>
    </div>
  );
}
