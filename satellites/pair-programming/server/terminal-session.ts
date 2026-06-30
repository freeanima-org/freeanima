import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

export type PtyProcess = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => () => void;
  onExit: (cb: (code: number) => void) => () => void;
};

export class TerminalSessionError extends Error {
  readonly code = "terminal_session_not_found";

  constructor(message = "Terminal conversation does not exist or has closed") {
    super(message);
    this.name = "TerminalSessionError";
  }
}

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
  const dataCbs = new Set<(data: string) => void>();
  const exitCbs = new Set<(code: number) => void>();

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
    onData: (cb) => {
      dataCbs.add(cb);
      return () => dataCbs.delete(cb);
    },
    onExit: (cb) => {
      exitCbs.add(cb);
      return () => exitCbs.delete(cb);
    },
  };
}

const sessions = new Map<string, PtyProcess>();

export function createTerminalSession(cwd?: string): { conversationId: string; pty: PtyProcess } {
  let workDir: string;
  const trimmed = cwd?.trim();
  if (trimmed) {
    workDir = resolve(trimmed);
    if (!existsSync(workDir)) {
      throw new TerminalSessionError(`workspace does not exist: ${workDir}`);
    }
  } else {
    workDir = process.cwd();
  }

  const conversationId = randomUUID();
  const pty = createScriptTerminal(workDir);
  sessions.set(conversationId, pty);
  return { conversationId, pty };
}

export function getTerminalSession(conversationId: string): PtyProcess | undefined {
  return sessions.get(conversationId);
}

export function closeTerminalSession(conversationId: string): void {
  const pty = sessions.get(conversationId);
  pty?.kill();
  sessions.delete(conversationId);
}
