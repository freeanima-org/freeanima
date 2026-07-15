import type { ToolSetRegistry } from "@freeanima/core/tool";
import { attachToolReturns, toolError } from "@freeanima/core/tool";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { CAPABILITIES_TOOLS_RETURNS } from "./return-schemas.ts";
import { assertPathAllowed } from "./path-policy.ts";
import { assertTerminalCommandAllowed, splitCommandLine } from "./terminal-command-policy.ts";

const MAX_OUTPUT = 50 * 1024;
const MAX_FOREGROUND_TIMEOUT = 600;

const backgroundProcs = new Map<string, ChildProcess>();
const backgroundOutput = new Map<string, string>();

function appendOutput(conversationId: string, chunk: Buffer): void {
  const prev = backgroundOutput.get(conversationId) ?? "";
  const next = prev + chunk.toString("utf-8");
  backgroundOutput.set(conversationId, next.length > MAX_OUTPUT ? next.slice(0, MAX_OUTPUT) : next);
}

function resolveWorkdir(workdir?: string | null): string | undefined {
  if (workdir == null || !workdir.trim()) return undefined;
  const deny = assertPathAllowed(workdir, "write");
  if (deny) throw new Error(deny);
  return workdir.trim();
}

function requireShellAllowed(): string | null {
  if (process.env.FREEANIMA_ALLOW_SHELL !== "true") {
    return "shell=true requires FREEANIMA_ALLOW_SHELL=true (pipes/redirection); default is argv spawn without shell";
  }
  return null;
}

function runForegroundArgv(argv: string[], timeout: number, workdir?: string): string {
  const safeTimeout = Math.min(Math.max(1, timeout), MAX_FOREGROUND_TIMEOUT);
  const bin = argv[0];
  if (!bin) return toolError("command is empty");
  try {
    const result = spawnSync(bin, argv.slice(1), {
      encoding: "utf-8",
      timeout: safeTimeout * 1000,
      cwd: workdir,
      maxBuffer: MAX_OUTPUT * 2,
    });
    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
    if (result.status !== 0 && result.status != null) {
      parts.push(`--- exit code: ${result.status} ---`);
    }
    let output = parts.join("");
    if (output.length > MAX_OUTPUT) {
      output = `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
    }
    return output;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean };
    if (err.killed) return toolError(`timeout after ${safeTimeout}s`);
    if (err.code === "ENOENT") return toolError(`executable not found: ${bin}`);
    return toolError(err.message);
  }
}

function runForegroundShell(command: string, timeout: number, workdir?: string): string {
  const safeTimeout = Math.min(Math.max(1, timeout), MAX_FOREGROUND_TIMEOUT);
  try {
    const result = spawnSync(command, {
      shell: true,
      encoding: "utf-8",
      timeout: safeTimeout * 1000,
      cwd: workdir,
      maxBuffer: MAX_OUTPUT * 2,
    });
    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`--- stderr ---\n${result.stderr}`);
    if (result.status !== 0 && result.status != null) {
      parts.push(`--- exit code: ${result.status} ---`);
    }
    let output = parts.join("");
    if (output.length > MAX_OUTPUT) {
      output = `${output.slice(0, MAX_OUTPUT)}\n... (truncated at ${MAX_OUTPUT} chars)`;
    }
    return output;
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { killed?: boolean };
    if (err.killed) return toolError(`timeout after ${safeTimeout}s`);
    if (err.code === "ENOENT") return toolError("shell not found");
    return toolError(err.message);
  }
}

function runBackgroundArgv(argv: string[], workdir?: string): string {
  const bin = argv[0];
  if (!bin) return toolError("command is empty");
  try {
    const proc = spawn(bin, argv.slice(1), {
      cwd: workdir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const conversationId = String(proc.pid ?? Date.now());
    backgroundOutput.set(conversationId, "");
    proc.stdout?.on("data", (c: Buffer) => appendOutput(conversationId, c));
    proc.stderr?.on("data", (c: Buffer) => appendOutput(conversationId, c));
    backgroundProcs.set(conversationId, proc);
    return (
      `[background PID ${proc.pid}, conversation_id=${conversationId}]\n` +
      `Use \`process('poll', conversation_id='${conversationId}')\` to check status.\n` +
      `Use \`process('kill', conversation_id='${conversationId}')\` to terminate.`
    );
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return toolError(`executable not found: ${bin}`);
    return toolError(err.message);
  }
}

function runBackgroundShell(command: string, workdir?: string): string {
  try {
    const proc = spawn(command, {
      shell: true,
      cwd: workdir,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const conversationId = String(proc.pid ?? Date.now());
    backgroundOutput.set(conversationId, "");
    proc.stdout?.on("data", (c: Buffer) => appendOutput(conversationId, c));
    proc.stderr?.on("data", (c: Buffer) => appendOutput(conversationId, c));
    backgroundProcs.set(conversationId, proc);
    return (
      `[background PID ${proc.pid}, conversation_id=${conversationId}]\n` +
      `Use \`process('poll', conversation_id='${conversationId}')\` to check status.\n` +
      `Use \`process('kill', conversation_id='${conversationId}')\` to terminate.`
    );
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return toolError("shell not found");
    return toolError(err.message);
  }
}

function getBgOutput(conversationId: string): string {
  return backgroundOutput.get(conversationId) ?? "";
}

async function handleProcess(
  action: string,
  conversationId?: string | null,
  timeout = 30,
): Promise<string> {
  if (action === "list") {
    if (backgroundProcs.size === 0) return "No background processes.";
    const lines = ["Background processes:"];
    for (const [sid, proc] of backgroundProcs) {
      const ret = proc.exitCode;
      const status = ret == null ? "running" : `exited (${ret})`;
      lines.push(`  ${sid.slice(0, 12)}…  PID ${proc.pid}  ${status}`);
    }
    return lines.join("\n");
  }

  if (!conversationId) return toolError("conversation_id required");
  const proc = backgroundProcs.get(conversationId);
  if (!proc) return toolError(`process ${conversationId} not found`);

  const output = getBgOutput(conversationId);

  if (action === "poll") {
    const ret = proc.exitCode;
    if (ret == null) return output ? `running\n${output}` : "running";
    return output ? `exited (${ret})\n${output}` : `exited (${ret})`;
  }

  if (action === "log") return output || "(no output)";

  if (action === "wait") {
    if (proc.exitCode != null) {
      return output ? `exited (${proc.exitCode})\n${output}` : `exited (${proc.exitCode})`;
    }
    const code = await new Promise<number | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), timeout * 1000);
      proc.once("close", (c) => {
        clearTimeout(timer);
        resolve(c);
      });
    });
    const out = getBgOutput(conversationId);
    if (code == null) return toolError(`timeout after ${timeout}s, process still running`);
    return out ? `exited (${code})\n${out}` : `exited (${code})`;
  }

  if (action === "kill") {
    proc.kill("SIGTERM");
    setTimeout(() => {
      if (proc.exitCode == null) proc.kill("SIGKILL");
    }, 5000);
    backgroundProcs.delete(conversationId);
    backgroundOutput.delete(conversationId);
    return `killed (${conversationId})`;
  }

  return toolError(`unsupported action '${action}'`);
}

function handleTerminal(
  command: string,
  timeout: number,
  workdir?: string | null,
  background = false,
  shell = false,
): string {
  if (!command?.trim()) return toolError("command is empty");

  let cwd: string | undefined;
  try {
    cwd = resolveWorkdir(workdir);
  } catch (e) {
    return toolError(e instanceof Error ? e.message : String(e));
  }

  const argv = shell ? null : splitCommandLine(command);
  const deny = assertTerminalCommandAllowed(command, {
    argv,
    workdir: cwd ?? process.cwd(),
  });
  if (deny) return toolError(deny);

  if (shell) {
    const shellDeny = requireShellAllowed();
    if (shellDeny) return toolError(shellDeny);
    if (background) return runBackgroundShell(command, cwd);
    return runForegroundShell(command, timeout, cwd);
  }

  const parts = argv ?? splitCommandLine(command);
  if (parts.length === 0) return toolError("command is empty");
  if (background) return runBackgroundArgv(parts, cwd);
  return runForegroundArgv(parts, timeout, cwd);
}

export function registerTerminalTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "terminal",
    "Terminal commands and background processes",
    attachToolReturns(
      [
        {
          name: "terminal_run",
          description:
            "Run a command in a subprocess and return output. Default shell=false (argv spawn, no pipes). " +
            "Set shell=true only when FREEANIMA_ALLOW_SHELL=true. Catastrophic targets (rm -rf /, ~, $HOME, system roots) are always blocked.",
          parameters: {
            type: "object",
            properties: {
              command: { type: "string" },
              timeout: {
                type: "integer",
                default: 180,
                minimum: 1,
                maximum: MAX_FOREGROUND_TIMEOUT,
              },
              workdir: { type: "string" },
              background: { type: "boolean", default: false },
              shell: {
                type: "boolean",
                default: false,
                description:
                  "Use a shell (pipes/redirection). Requires FREEANIMA_ALLOW_SHELL=true. Default false.",
              },
              pty: { type: "boolean", default: false },
            },
            required: ["command"],
          },
          handler: (a) =>
            handleTerminal(
              String(a.command),
              Number(a.timeout ?? 180),
              a.workdir != null ? String(a.workdir) : null,
              Boolean(a.background),
              Boolean(a.shell),
            ),
        },
        {
          name: "terminal_process",
          description: "Manage background processes started with terminal_run(background=true)",
          parameters: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["list", "poll", "log", "wait", "kill"],
              },
              conversation_id: { type: "string" },
              timeout: { type: "integer", default: 30 },
            },
            required: ["action"],
          },
          handler: (a) =>
            handleProcess(
              String(a.action),
              a.conversation_id != null ? String(a.conversation_id) : null,
              Number(a.timeout ?? 30),
            ),
        },
      ],
      CAPABILITIES_TOOLS_RETURNS,
    ),
  );
}
