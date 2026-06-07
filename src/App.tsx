import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logoUrl from "./assets/logo.png";
import { useSettingsStore } from "./store/settingsStore";
import { useSnapshotStore } from "./store/snapshotStore";

const Dashboard   = lazy(() => import("./tabs/Dashboard"));
const RunAgent    = lazy(() => import("./tabs/RunAgent"));
const Competitors = lazy(() => import("./tabs/Competitors"));
const History     = lazy(() => import("./tabs/History"));
const Sheets      = lazy(() => import("./tabs/Sheets"));
const Settings    = lazy(() => import("./tabs/Settings"));

type TabKey = "dashboard" | "run" | "competitors" | "history" | "sheets" | "settings";

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
  operatorOnly?: boolean;   // hidden in viewer mode
}

const TABS: TabDef[] = [
  { key: "dashboard",   label: "Dashboard",   icon: "▰" },
  { key: "run",         label: "Run Agent",   icon: "▶", operatorOnly: true },
  { key: "competitors", label: "Competitors", icon: "◆" },
  { key: "history",     label: "History",     icon: "◷" },
  { key: "sheets",      label: "Sheets",      icon: "▤" },
  { key: "settings",    label: "Settings",    icon: "✦" },
];

function renderTab(key: TabKey) {
  switch (key) {
    case "dashboard":   return <Dashboard />;
    case "run":         return <RunAgent />;
    case "competitors": return <Competitors />;
    case "history":     return <History />;
    case "sheets":      return <Sheets />;
    case "settings":    return <Settings />;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("dashboard");
  const { mode, loaded, load, snapshotUrl } = useSettingsStore();
  const loadSnapshot = useSnapshotStore((s) => s.load);

  // Load persisted settings once on mount.
  useEffect(() => {
    void load();
  }, [load]);

  // In viewer mode, fetch the snapshot whenever the URL changes (and on first
  // settings-load). Operator mode reads from local filesystem so no fetch needed.
  useEffect(() => {
    if (!loaded) return;
    if (mode === "viewer") {
      void loadSnapshot(snapshotUrl);
    }
  }, [loaded, mode, snapshotUrl, loadSnapshot]);

  // Filter tabs based on mode. Memoized so the sidebar doesn't re-render unnecessarily.
  const visibleTabs = useMemo(
    () => TABS.filter((t) => !(t.operatorOnly && mode === "viewer")),
    [mode],
  );

  // If the active tab gets hidden by a mode switch (e.g. user was on Run Agent
  // then switched to viewer), bounce them to Dashboard so the UI doesn't show
  // a blank pane.
  useEffect(() => {
    if (!visibleTabs.find((t) => t.key === activeTab)) {
      setActiveTab("dashboard");
    }
  }, [visibleTabs, activeTab]);

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 glass border-r border-cyan/20 flex flex-col flex-shrink-0">
        <div className="px-5 py-6 border-b border-cyan/10 flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Compintel"
            className="w-10 h-10 flex-shrink-0 rounded-md"
            draggable={false}
          />
          <div>
            <div className="text-xl font-bold text-white leading-tight tracking-tight">
              Compintel
            </div>
            <div className="text-[10px] tracking-widest text-text-dim mt-1">
              COMPETITIVE INTEL
            </div>
          </div>
        </div>

        <nav className="flex-1 py-3">
          {visibleTabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative w-full text-left px-5 py-2.5 mb-0.5 text-sm flex items-center gap-3 transition-all ${
                  active
                    ? "text-cyan bg-cyan/5"
                    : "text-text-dim hover:text-text hover:bg-white/[0.02]"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="active-indicator"
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan shadow-glow-cyan"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="opacity-70 text-xs">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Mode pill — visual confirmation of current data source */}
        <div className="px-5 py-3 border-t border-cyan/10">
          <div className="flex items-center gap-2 text-[10px] tracking-widest uppercase">
            <span className={`w-1.5 h-1.5 rounded-full ${mode === "operator" ? "bg-green shadow-glow-green" : "bg-cyan shadow-glow-cyan"}`} />
            <span className="text-text-dim">{mode === "operator" ? "Operator" : "Viewer"} mode</span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-cyan/10 text-[10px] text-text-dim">
          v0.2.0
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.6 }}
            className="absolute inset-0 p-8 overflow-hidden"
          >
            <Suspense fallback={<div className="text-text-dim">{loaded ? "Loading…" : "Starting Compintel…"}</div>}>
              {renderTab(activeTab)}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
