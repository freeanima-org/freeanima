import { useEffect, useState } from "react";

import {
  clearTerminalLogs,
  subscribeTerminalLogs,
  type TerminalLogEntry,
} from "../lib/tools-executor.ts";

export function TerminalLogPanel() {
  const [logs, setLogs] = useState<TerminalLogEntry[]>([]);

  useEffect(() => subscribeTerminalLogs((entries) => setLogs([...entries])), []);

  if (logs.length === 0) {
    return <p className="muted">terminal_run 输出会出现在此（一次性命令日志，非交互 PTY）。</p>;
  }

  return (
    <div className="coding-term-logs">
      <div className="coding-term-toolbar">
        <button type="button" className="coding-btn" onClick={() => clearTerminalLogs()}>
          清空
        </button>
        <span className="muted">{logs.length} 条</span>
      </div>
      {logs.map((entry) => (
        <article key={entry.id} className="coding-term-entry">
          <header>
            <code>$ {entry.command}</code>
            <span className="muted">
              {entry.workdir} · {entry.ok ? "ok" : "err"} ·{" "}
              {new Date(entry.at).toLocaleTimeString()}
            </span>
          </header>
          <pre>{entry.output}</pre>
        </article>
      ))}
    </div>
  );
}
