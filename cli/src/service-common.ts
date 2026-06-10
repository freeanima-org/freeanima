import { PATHS } from "@freeanima/service-config";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { isServerAlive } from "@freeanima/service/alive";
import { prettyDuration, writeStatusLine } from "./output/status.ts";

export { prettyDuration, writeStatusLine };

export const LOG_FILE = join(PATHS.home, "error.log");

export { resolveProbeHost } from "@freeanima/service/bind-hosts";

export function readRecentErrorLogTail(maxLines = 10): string[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    const text = readFileSync(LOG_FILE, "utf-8").trim();
    if (!text) return [];
    return text.split("\n").slice(-maxLines);
  } catch {
    return [];
  }
}

function userConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) return xdg;
  return join(homedir(), ".config");
}

export function serviceUnitDir(): string {
  return join(userConfigDir(), "systemd", "user");
}

export function serviceUnitPath(): string {
  return join(serviceUnitDir(), "anima.service");
}

export async function apiGet(
  host: string,
  port: number,
  path: string,
  timeoutMs = 3000,
): Promise<Record<string, unknown> | null> {
  const url = `http://${host}:${port}${path}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!resp.ok) return null;
    return (await resp.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function checkServerAlive(): number | null {
  return isServerAlive();
}

/** Executable path for systemd ExecStart (shebang script or bun + cli.js) */
export function animaBin(): string {
  const script = process.argv[1];
  // Prefer current process when it is the TS CLI, avoiding stale freeanima / Python entry on PATH
  if (script?.endsWith("cli.js") || script?.endsWith("cli.ts")) {
    return `${process.execPath} ${realpathSync(script)}`;
  }

  try {
    const r = spawnSync("sh", ["-c", "command -v anima"], { encoding: "utf-8" });
    const found = r.stdout?.trim();
    if (r.status === 0 && found) return found;
  } catch {
    /* ignore */
  }

  return script ? realpathSync(script) : "anima";
}

/** Resolve animaBin() to spawn(command, args) form */
export function resolveAnimaSpawn(extraArgs: string[]): { command: string; args: string[] } {
  const bin = animaBin();
  if (bin.includes(" ")) {
    const space = bin.indexOf(" ");
    return {
      command: bin.slice(0, space),
      args: [bin.slice(space + 1), ...extraArgs],
    };
  }
  return { command: bin, args: extraArgs };
}
