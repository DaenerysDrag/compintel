// App-wide error boundary (V2.1 crash capture).
//
// Catches render-time errors anywhere in the tree, persists them via
// recordCrash(), and shows a recoverable fallback with one-click reporting +
// copy-diagnostics. Without this, a single bad render = white screen with no
// signal back to us from a tester's machine.

import { Component, type ErrorInfo, type ReactNode } from "react";
import {
  recordCrash,
  diagnosticsBlock,
  feedbackIssueUrl,
  clearCrash,
} from "../lib/diagnostics";
import { openUrl } from "@tauri-apps/plugin-opener";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordCrash({
      at: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack || info.componentStack || undefined,
      source: "boundary",
    });
  }

  private reload = () => {
    clearCrash();
    this.setState({ hasError: false, message: "" });
    // Full reload clears any wedged state in the lazy-loaded tab tree.
    if (typeof window !== "undefined") window.location.reload();
  };

  private copyDiagnostics = () => {
    void navigator.clipboard?.writeText(diagnosticsBlock());
  };

  private report = () => {
    void openUrl(feedbackIssueUrl("bug"));
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-bg p-8">
        <div className="glass max-w-lg w-full rounded-xl border border-red/30 p-8 text-center">
          <div className="text-4xl mb-3">◇</div>
          <h1 className="text-xl font-bold text-white mb-2">Compintel hit a snag</h1>
          <p className="text-sm text-text-dim mb-1">
            The view crashed, but your data is safe. Reloading usually fixes it.
          </p>
          <p className="text-xs text-red/80 font-mono mb-6 break-words">{this.state.message}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.reload}
              className="px-4 py-2 rounded bg-cyan/10 border border-cyan/40 text-cyan text-sm hover:bg-cyan/20 transition-colors"
            >
              ↻ Reload
            </button>
            <button
              onClick={this.report}
              className="px-4 py-2 rounded border border-red/40 text-red text-sm hover:bg-red/10 transition-colors"
            >
              Report on GitHub
            </button>
            <button
              onClick={this.copyDiagnostics}
              className="px-4 py-2 rounded border border-white/15 text-text-dim text-sm hover:text-text hover:bg-white/[0.03] transition-colors"
            >
              Copy diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }
}
