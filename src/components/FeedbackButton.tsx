// Sidebar feedback entry point (V2.1).
//
// Opens a prefilled GitHub issue (bug or idea) in the user's browser, with
// auto-filled diagnostics. This is the return path testers currently lack.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { openUrl } from "@tauri-apps/plugin-opener";
import { feedbackIssueUrl, type FeedbackKind } from "../lib/diagnostics";
import { useSettingsStore } from "../store/settingsStore";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const mode = useSettingsStore((s) => s.mode);

  const send = (kind: FeedbackKind) => {
    void openUrl(feedbackIssueUrl(kind, { mode }));
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full text-left text-[11px] tracking-wide text-text-dim hover:text-cyan transition-colors flex items-center gap-2"
      >
        <span className="opacity-70">✎</span>
        <span>Send feedback</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="glass w-[380px] rounded-xl border border-cyan/20 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-bold text-white mb-1">Send feedback</h2>
              <p className="text-xs text-text-dim mb-5">
                Opens a prefilled GitHub issue in your browser. Diagnostics
                (app version, OS, last error) are attached automatically.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => send("bug")}
                  className="rounded-lg border border-red/30 px-4 py-5 text-center hover:bg-red/10 transition-colors"
                >
                  <div className="text-2xl mb-1">🐞</div>
                  <div className="text-sm text-white font-semibold">Report a bug</div>
                  <div className="text-[10px] text-text-dim mt-0.5">something broke</div>
                </button>
                <button
                  onClick={() => send("idea")}
                  className="rounded-lg border border-cyan/30 px-4 py-5 text-center hover:bg-cyan/10 transition-colors"
                >
                  <div className="text-2xl mb-1">💡</div>
                  <div className="text-sm text-white font-semibold">Suggest an idea</div>
                  <div className="text-[10px] text-text-dim mt-0.5">a feature or change</div>
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="mt-4 w-full text-center text-xs text-text-dim hover:text-text transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
