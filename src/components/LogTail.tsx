// Live-tail viewer for /tmp/nowgg-agent.log + /tmp/nowgg-weekly-digest.log.
// Listens on the global `log:line` event and accumulates lines per channel.

import { useEffect, useRef, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { ipc } from "../lib/ipc";

type Channel = "daily" | "weekly";

interface LogLineEvent {
  channel: Channel;
  line: string;
}

const MAX_LINES = 500;

export function LogTail({ channel, title }: { channel: Channel; title: string }) {
  const [lines, setLines] = useState<string[]>([]);
  const [tailing, setTailing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // Auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  const start = async () => {
    setError(null);
    setLines([]);
    try {
      if (!unlistenRef.current) {
        unlistenRef.current = await listen<LogLineEvent>("log:line", (evt) => {
          if (evt.payload.channel !== channel) return;
          setLines((prev) => {
            const next = [...prev, evt.payload.line];
            return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
          });
        });
      }
      await ipc.startLogTail(channel);
      setTailing(true);
    } catch (err) {
      setError(String(err));
    }
  };

  const stop = async () => {
    try {
      await ipc.stopLogTail(channel);
    } catch (err) {
      console.warn("stop log tail:", err);
    }
    setTailing(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
      ipc.stopLogTail(channel).catch(() => {});
    };
  }, [channel]);

  return (
    <div className="border border-cyan/15 rounded-lg overflow-hidden flex flex-col bg-[#030711]">
      <div className="px-4 py-2 border-b border-white/5 text-[10px] uppercase tracking-widest text-text-dim flex items-center justify-between">
        <span>{title}</span>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px]">{lines.length} lines</span>
          {tailing ? (
            <button
              onClick={stop}
              className="px-2 py-0.5 rounded border border-red/40 text-red text-[10px] hover:bg-red/10 transition"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={start}
              className="px-2 py-0.5 rounded border border-cyan/40 text-cyan text-[10px] hover:bg-cyan/10 transition"
            >
              Start tail
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="px-4 py-2 text-red text-[11px] border-b border-red/20 bg-red/5">
          {error}
        </div>
      )}
      <div
        ref={scrollRef}
        className="px-3 py-2 font-mono text-[11px] leading-relaxed overflow-y-auto"
        style={{ height: "240px" }}
      >
        {lines.length === 0 ? (
          <div className="text-text-dim italic">
            {tailing ? "Waiting for new output…" : "Click 'Start tail' to begin streaming."}
          </div>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="text-text whitespace-pre-wrap break-all">
              {line || " "}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
