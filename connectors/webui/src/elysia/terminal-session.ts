import { resolveWorkspace } from "@freeanima/service-api";
import { existsSync } from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";

export type PtyProcess = {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  onData: (cb: (data: string) => void) => () => void;
  onExit: (cb: (code: number) => void) => () => void;
};

export type TerminalEvent =
  | { type: "ready"; sessionId: string }
  | { type: "output"; data: string }
  | { type: "exit"; code: number }
  | { type: "error"; message: string };

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

export class TerminalSessionError extends Error {
  readonly code = "terminal_session_not_found";

  constructor(message = "Terminal session does not exist or has closed") {
    super(message);
    this.name = "TerminalSessionError";
  }
}

const sessions = new Map<string, PtyProcess>();

export function createTerminalSession(): { sessionId: string; pty: PtyProcess } {
  let cwd: string;
  try {
    cwd = resolveWorkspace();
    if (!cwd || !existsSync(cwd)) {
      throw new TerminalSessionError();
    }
  } catch (e) {
    if (e instanceof TerminalSessionError) throw e;
    throw new TerminalSessionError();
  }

  const sessionId = crypto.randomUUID();
  const pty = createScriptTerminal(cwd);
  sessions.set(sessionId, pty);
  return { sessionId, pty };
}

export function getTerminalSession(sessionId: string): PtyProcess | undefined {
  return sessions.get(sessionId);
}

export function closeTerminalSession(sessionId: string): void {
  const pty = sessions.get(sessionId);
  pty?.kill();
  sessions.delete(sessionId);
}

export async function* streamTerminalEvents(
  sessionId: string,
  pty: PtyProcess,
  signal: AbortSignal | undefined,
): AsyncGenerator<TerminalEvent> {
  const ee = new EventEmitter();
  const offData = pty.onData((data) => ee.emit("output", data));
  const offExit = pty.onExit((code) => ee.emit("exit", code));

  yield { type: "ready", sessionId };

  try {
    while (!signal?.aborted) {
      const event = await new Promise<TerminalEvent | null>((resolve) => {
        const onOutput = (data: string) => resolve({ type: "output", data });
        const onExit = (code: number) => resolve({ type: "exit", code });
        const onAbort = () => resolve(null);

        ee.once("output", onOutput);
        ee.once("exit", onExit);
        signal?.addEventListener("abort", onAbort, { once: true });

        const cleanup = () => {
          ee.off("output", onOutput);
          ee.off("exit", onExit);
          signal?.removeEventListener("abort", onAbort);
        };

        ee.once("output", () => cleanup());
        ee.once("exit", () => cleanup());
        signal?.addEventListener(
          "abort",
          () => {
            cleanup();
          },
          { once: true },
        );
      });

      if (event === null) break;
      yield event;
      if (event.type === "exit") break;
    }
  } finally {
    offData();
    offExit();
    closeTerminalSession(sessionId);
  }
}

export function closeAllTerminalSessions(): void {
  for (const [id, pty] of sessions) {
    pty.kill();
    sessions.delete(id);
  }
}
