// Snapshot staleness banner (V2.1, Theme C).
//
// Viewer-mode data is only as fresh as the last agent run + snapshot upload.
// Since the agent skips weekends and idles when backlogs are exhausted, the
// data can sit still for days. This banner makes that honest at a glance.

import { motion } from "framer-motion";

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

interface Props {
  generatedAt: string | null;   // null in operator mode → banner hidden
  lastRunDate: string | null;
  allExhausted: boolean;
}

export function StalenessBanner({ generatedAt, lastRunDate, allExhausted }: Props) {
  const age = daysSince(generatedAt);
  if (age == null) return null; // operator mode or unparseable → nothing to show

  // Fresh data with nothing to flag → stay out of the way.
  if (age <= 2 && !allExhausted) return null;

  const tone =
    age > 7 || allExhausted
      ? { border: "border-red/40", bg: "bg-red/[0.07]", dot: "bg-red", text: "text-red" }
      : { border: "border-yellow/40", bg: "bg-yellow/[0.07]", dot: "bg-yellow", text: "text-yellow" };

  const ageLabel =
    age === 0 ? "today" : age === 1 ? "1 day ago" : `${age} days ago`;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-5 rounded-lg border ${tone.border} ${tone.bg} px-4 py-2.5 flex items-center gap-3`}
    >
      <span className={`w-2 h-2 rounded-full ${tone.dot} flex-shrink-0`} />
      <div className="text-xs leading-relaxed">
        <span className={`font-semibold ${tone.text}`}>
          Snapshot updated {ageLabel}
        </span>
        <span className="text-text-dim">
          {lastRunDate ? ` · last agent run ${lastRunDate}` : ""}
          {allExhausted
            ? " · all competitor backlogs are exhausted — data won't change until a new competitor is added."
            : " · this view reflects the last published snapshot, not live data."}
        </span>
      </div>
    </motion.div>
  );
}
