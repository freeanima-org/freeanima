import { useEffect, useRef, useState } from "react";
// oxlint-disable-next-line import/no-unassigned-import -- Vite side-effect stylesheet
import "xterm/css/xterm.css";
import { Button } from "@freeanima/ui-kit";
import { m } from "@pair/lib/i18n.ts";
import { getStudioTerminalRuntime } from "@pair/lib/studio-terminal-runtime.ts";

function reconnectStudioTerminal(): void {
  getStudioTerminalRuntime().reconnect();
}

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

  return (
    <div className="h-full flex flex-col min-h-0 border-t border bg-[#1e1e1e] overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1 border-b border shrink-0 bg-muted/30">
        <span className="text-xs font-medium text-muted-foreground">{m.pair_terminal()}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={reconnectStudioTerminal}
        >
          {m.admin_common_reconnect()}
        </Button>
      </div>
      <div
        ref={termElRef}
        className="flex-1 min-h-0 overflow-hidden [&_.xterm]:h-full [&_.xterm]:p-1"
      />
      {statusMsg ? (
        <div className="px-2 py-1 text-xs text-destructive shrink-0 bg-muted/30">{statusMsg}</div>
      ) : null}
    </div>
  );
}
