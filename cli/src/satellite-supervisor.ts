import { satelliteEntrySchema, type SatelliteEntryConfig } from "@freeanima/core/config";
import { PATHS } from "@freeanima/platform/config";
import { FileConfig } from "@freeanima/platform/config";
import { REPO_ROOT } from "@freeanima/platform";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

export type EnabledSatellite = {
  name: string;
  config: SatelliteEntryConfig;
};

const foregroundChildren = new Map<string, ChildProcess>();

function pidPath(name: string): string {
  return join(PATHS.satellitesRuntimeDir, `${name}.pid`);
}

export function loadEnabledSatellites(): EnabledSatellite[] {
  const cfg = FileConfig.open().data;
  const entries = cfg.satellites ?? {};
  const out: EnabledSatellite[] = [];
  for (const [name, raw] of Object.entries(entries)) {
    const parsed = satelliteEntrySchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.enabled === false) continue;
    out.push({ name, config: parsed.data });
  }
  return out;
}

function buildEnv(name: string, entry: SatelliteEntryConfig): Record<string, string> {
  const env: Record<string, string> = {
    ...process.env,
    FREEANIMA_REPO_ROOT: REPO_ROOT,
    ...entry.env,
  };
  if (entry.workspace?.trim()) {
    env.STUDIO_WORKSPACE = entry.workspace.trim();
  }
  if (entry.gitignore !== undefined) {
    env.STUDIO_GITIGNORE = entry.gitignore ? "true" : "false";
  }
  if (entry.showHidden !== undefined) {
    env.STUDIO_SHOW_HIDDEN = entry.showHidden ? "true" : "false";
  }
  if (name === "pair-programming" && !env.SATELLITE_PORT) {
    env.SATELLITE_PORT = "4173";
  }
  const hub = process.env.FREEANIMA_URL ?? "http://127.0.0.1:2658";
  env.FREEANIMA_URL = hub;
  return env;
}

function writePid(name: string, pid: number): void {
  mkdirSync(PATHS.satellitesRuntimeDir, { recursive: true });
  writeFileSync(pidPath(name), String(pid), "utf-8");
}

function readPid(name: string): number | null {
  const p = pidPath(name);
  if (!existsSync(p)) return null;
  const n = Number.parseInt(readFileSync(p, "utf-8").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function clearPid(name: string): void {
  try {
    unlinkSync(pidPath(name));
  } catch {
    /* ignore */
  }
}

function killPid(pid: number, signal: NodeJS.Signals = "SIGTERM"): void {
  try {
    process.kill(pid, signal);
  } catch {
    /* already dead */
  }
}

export function startSatellite(
  name: string,
  entry: SatelliteEntryConfig,
  opts?: { foreground?: boolean },
): void {
  const existing = readPid(name);
  if (existing !== null) {
    try {
      process.kill(existing, 0);
      console.log(`Satellite ${name} already running (PID ${existing})`);
      return;
    } catch {
      clearPid(name);
    }
  }

  const cwd = entry.cwd?.trim() || REPO_ROOT;
  const env = buildEnv(name, entry);
  const child = spawn(entry.command, entry.args ?? [], {
    cwd,
    env,
    detached: !opts?.foreground,
    stdio: opts?.foreground ? "inherit" : "ignore",
  });

  if (child.pid == null) {
    throw new Error(`Failed to start satellite ${name}`);
  }

  if (opts?.foreground) {
    foregroundChildren.set(name, child);
  } else {
    child.unref();
  }

  writePid(name, child.pid);
  console.log(`Satellite ${name} started (PID ${child.pid})`);
}

export function startAllSatellites(opts?: { foreground?: boolean }): void {
  const list = loadEnabledSatellites();
  if (list.length === 0) return;
  for (const { name, config } of list) {
    startSatellite(name, config, opts);
  }
}

export function stopAllSatellites(): void {
  for (const [name, child] of foregroundChildren) {
    killPid(child.pid ?? 0);
    foregroundChildren.delete(name);
    clearPid(name);
  }

  const dir = PATHS.satellitesRuntimeDir;
  if (!existsSync(dir)) return;
  for (const { name } of loadEnabledSatellites()) {
    const pid = readPid(name);
    if (pid != null) {
      killPid(pid);
      clearPid(name);
      console.log(`Satellite ${name} stopped (PID ${pid})`);
    }
  }
}

export function stopSatellitesBeforeExit(): void {
  stopAllSatellites();
}
