import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ipc } from "../lib/ipc";
import type { RunLogRow } from "../lib/types";
import { Card, Pill } from "../components/Card";

function emailVariant(s: string): "green" | "red" | "default" {
  if (s.includes("✅")) return "green";
  if (s.toLowerCase().includes("fail")) return "red";
  return "default";
}

export default function History() {
  const [rows, setRows] = useState<RunLogRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ipc.readRunLog()
      .then((r) => {
        setRows(r);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  const competitors = useMemo(() => {
    const set = new Set(rows.map((r) => r.competitor));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = filter === "all" ? rows : rows.filter((r) => r.competitor === filter);

  const totalInvestigated = filtered.reduce((s, r) => s + r.investigated, 0);
  const totalFound = filtered.reduce((s, r) => s + r.found, 0);
  const totalBlocked = filtered.reduce((s, r) => s + r.blocked, 0);

  if (loading) return <div className="text-text-dim">Loading…</div>;
  if (error) return <div className="text-red">Error: {error}</div>;

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">History</h1>
          <p className="text-sm text-text-dim mt-1">
            {rows.length} run{rows.length === 1 ? "" : "s"} recorded in Agent Run Log
          </p>
        </div>
        <div className="flex gap-2">
          {competitors.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`text-xs px-3 py-1.5 rounded border transition ${
                filter === c
                  ? "border-cyan/50 text-cyan bg-cyan/10"
                  : "border-white/10 text-text-dim hover:text-text"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Filtered totals */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Investigated</div>
          <div className="text-2xl font-bold text-white">{totalInvestigated}</div>
        </Card>
        <Card accent="green">
          <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Confirmed</div>
          <div className="text-2xl font-bold text-green">{totalFound}</div>
        </Card>
        <Card accent="red">
          <div className="text-[10px] uppercase tracking-widest text-text-dim mb-1">Blocked</div>
          <div className="text-2xl font-bold text-red">{totalBlocked}</div>
        </Card>
      </div>

      {/* Run table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-text-dim border-b border-white/5">
                <th className="text-left px-2 py-2 font-normal">Date</th>
                <th className="text-left px-2 py-2 font-normal">Competitor</th>
                <th className="text-right px-2 py-2 font-normal">Investigated</th>
                <th className="text-right px-2 py-2 font-normal">Found</th>
                <th className="text-right px-2 py-2 font-normal">Blocked</th>
                <th className="text-left px-2 py-2 font-normal">Email</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr
                  key={`${r.date}-${r.competitor}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.015, duration: 0.2 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <td className="px-2 py-2.5 text-text-dim font-mono text-[12px]">{r.date}</td>
                  <td className="px-2 py-2.5 text-white">{r.competitor}</td>
                  <td className="px-2 py-2.5 text-right text-text">{r.investigated}</td>
                  <td className="px-2 py-2.5 text-right text-green font-semibold">{r.found}</td>
                  <td className="px-2 py-2.5 text-right text-red">{r.blocked}</td>
                  <td className="px-2 py-2.5">
                    <Pill variant={emailVariant(r.emailStatus)}>{r.emailStatus.length > 40 ? r.emailStatus.slice(0, 37) + "…" : r.emailStatus}</Pill>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center text-text-dim py-8">
              No runs recorded yet for this filter.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
