import { useEffect, useRef, useState } from "react";
import "xterm/css/xterm.css";
import { getStudioTerminalRuntime } from "@/lib/studio-terminal-runtime.ts";

export function TerminalPanel() {
  const termElRef = useRef<HTMLDivElement>(null);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const termEl = termElRef.current;
    if (!termEl) return;

    const runtime = getStudioTerminalRuntime();
    runtime.attach(termEl, setStatusMsg);
    return () => runtime.detach();
  }, []);

  const reconnect = () => {
    getStudioTerminalRuntime().reconnect();
  };

  return (
    <div className="h-full flex flex-col min-h-0 border-t border-base-300 bg-[#1e1e1e] overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 border-b border-base-300 shrink-0 bg-base-200/30">
        <span className="text-xs font-medium text-base-content/70">终端</span>
        <button type="button" className="btn btn-ghost btn-xs" onClick={reconnect}>
          重连
        </button>
      </div>
      <div
        ref={termElRef}
        className="flex-1 min-h-0 overflow-hidden [&_.xterm]:h-full [&_.xterm]:p-1"
      />
      {statusMsg ? (
        <div className="px-2 py-1 text-xs text-error shrink-0 bg-base-200/30">{statusMsg}</div>
      ) : null}
    </div>
  );
}
