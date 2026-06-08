import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import "xterm/css/xterm.css";
import { api } from "@/lib/api.ts";

export function TerminalPanel() {
  const termElRef = useRef<HTMLDivElement>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const sessionIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const termEl = termElRef.current;
    if (!termEl) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.2,
      fontFamily: 'ui-monospace, "Cascadia Code", Menlo, monospace',
      convertEol: true,
      scrollback: 5000,
      theme: {
        background: "#1e1e1e",
        foreground: "#d4d4d4",
        cursor: "#d4d4d4",
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termEl);

    const fitTerminal = () => {
      try {
        fitAddon.fit();
        const sid = sessionIdRef.current;
        if (sid) {
          void api.studio.terminal.resize.mutate({
            sessionId: sid,
            cols: term.cols,
            rows: term.rows,
          });
        }
      } catch {
        /* 容器尺寸为 0 时忽略 */
      }
    };

    const sendInput = (data: string) => {
      const sid = sessionIdRef.current;
      if (sid) {
        void api.studio.terminal.write.mutate({ sessionId: sid, data });
      }
    };

    const connect = () => {
      unsubRef.current?.();
      unsubRef.current = null;
      sessionIdRef.current = null;
      setStatusMsg("");

      const sub = api.studio.terminal.stream.subscribe(undefined, {
        onData: (msg) => {
          if (msg.type === "ready" && msg.sessionId) {
            sessionIdRef.current = msg.sessionId;
            requestAnimationFrame(fitTerminal);
          } else if (msg.type === "output" && msg.data !== undefined) {
            term.write(msg.data);
          } else if (msg.type === "error" && msg.message) {
            setStatusMsg(msg.message);
          } else if (msg.type === "exit" && msg.code !== undefined) {
            setStatusMsg(`进程退出 (${msg.code})`);
          }
        },
        onError: () => setStatusMsg("WebSocket 连接失败"),
        onComplete: () => {
          setStatusMsg((prev) => prev || "连接已断开");
        },
      });
      unsubRef.current = () => sub.unsubscribe();
    };

    term.onData(sendInput);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(fitTerminal);
    });
    ro.observe(termEl);

    requestAnimationFrame(fitTerminal);
    connect();

    const reconnect = () => {
      term.clear();
      connect();
    };

    (termEl as HTMLDivElement & { __reconnect?: () => void }).__reconnect = reconnect;

    return () => {
      ro.disconnect();
      unsubRef.current?.();
      const sid = sessionIdRef.current;
      if (sid) {
        void api.studio.terminal.close.mutate({ sessionId: sid });
      }
      term.dispose();
    };
  }, []);

  const reconnect = () => {
    const el = termElRef.current as (HTMLDivElement & { __reconnect?: () => void }) | null;
    el?.__reconnect?.();
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
