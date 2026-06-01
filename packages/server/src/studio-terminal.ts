import { resolveWorkspace } from "@freeanima/runtime";
import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";


type PtyProcess = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (code: number) => void) => void;
};

/** script(1) 伪终端：避免 pipe + bash -i 的 job control 与显示错乱 */
function createScriptTerminal(cwd: string): PtyProcess {
  const shell = process.env.SHELL || "/bin/bash";
  let proc: ChildProcessWithoutNullStreams | null = spawn(
    "script",
    ["-q", "-c", `${shell} -l`, "/dev/null"],
    {
      cwd,
      env: { ...process.env, TERM: "xterm-256color" },
      stdio: "pipe",
    },
  );
  const dataCbs: Array<(data: string) => void> = [];
  const exitCbs: Array<(code: number) => void> = [];

  const forward = (buf: Buffer) => {
    const text = buf.toString("utf-8");
    for (const cb of dataCbs) cb(text);
  };

  proc.stdout?.on("data", forward);
  proc.stderr?.on("data", forward);
  proc.on("exit", (code) => {
    for (const cb of exitCbs) cb(code ?? 0);
  });

  return {
    write: (d) => proc?.stdin?.write(d),
    resize: () => {},
    kill: () => {
      proc?.kill();
      proc = null;
    },
    onData: (cb) => dataCbs.push(cb),
    onExit: (cb) => exitCbs.push(cb),
  };
}

type WsHolder = {
  send: (data: string) => void;
  _pty?: PtyProcess | null;
};

export function studioTerminalHandler() {
  return {
    onOpen(_evt: Event, ws: WsHolder) {
      let cwd: string;
      try {
        cwd = resolveWorkspace();
        if (!cwd || !existsSync(cwd)) {
          ws.send(JSON.stringify({ type: "error", message: "studio.workspace 未配置或不存在" }));
          return;
        }
      } catch (e) {
        ws.send(JSON.stringify({ type: "error", message: String(e) }));
        return;
      }

      const p = createScriptTerminal(cwd);
      ws._pty = p;
      p.onData((data) => ws.send(JSON.stringify({ type: "output", data })));
      p.onExit((code) => ws.send(JSON.stringify({ type: "exit", code })));
      ws.send(JSON.stringify({ type: "ready" }));
    },

    onMessage(evt: MessageEvent, ws: WsHolder) {
      const pty = ws._pty;
      if (!pty) return;
      try {
        const msg = JSON.parse(String(evt.data)) as {
          type?: string;
          data?: string;
          cols?: number;
          rows?: number;
        };
        if (msg.type === "input" && typeof msg.data === "string") {
          pty.write(msg.data);
        } else if (msg.type === "resize") {
          pty.resize(Number(msg.cols) || 80, Number(msg.rows) || 24);
        }
      } catch {
        pty.write(String(evt.data));
      }
    },

    onClose(_evt: Event, ws: WsHolder) {
      ws._pty?.kill();
      ws._pty = null;
    },
  };
}
