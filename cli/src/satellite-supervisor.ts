import { satelliteEntrySchema, type SatelliteEntryConfig } from "@freeanima/core/config";
import { FileConfig } from "@freeanima/platform/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { resolveSatelliteLaunch, type SatelliteLaunch } from "./satellite-launch.ts";
import {
  renderSatelliteSystemdUnit,
  satelliteServiceUnitFileName,
  satelliteSystemdUnitName,
} from "./satellite-systemd-unit.ts";
import { serviceUnitDir, writeStatusLine } from "./service-common.ts";
import { systemdUserAvailable } from "./systemd-unit.ts";

export type ManagedSatellite = {
  name: string;
  config: SatelliteEntryConfig;
};

const foregroundChildren = new Map<string, ChildProcess>();

function systemctl(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
}

/** Config entries with command and enabled !== false (managed satellites only). */
export function loadManagedSatellites(): ManagedSatellite[] {
  const cfg = FileConfig.open().data;
  const entries = cfg.satellites ?? {};
  const out: ManagedSatellite[] = [];
  for (const [name, raw] of Object.entries(entries)) {
    const parsed = satelliteEntrySchema.safeParse(raw);
    if (!parsed.success) continue;
    if (parsed.data.enabled === false) continue;
    if (!parsed.data.command?.trim()) continue;
    out.push({ name, config: parsed.data });
  }
  return out;
}

function hubUrl(host: string, port: number): string {
  return process.env.FREEANIMA_URL ?? `http://${host}:${port}`;
}

function satelliteUnitPath(name: string): string {
  return join(serviceUnitDir(), satelliteServiceUnitFileName(name));
}

function resolveLaunchForSatellite(
  entry: SatelliteEntryConfig,
  host: string,
  port: number,
): SatelliteLaunch {
  return resolveSatelliteLaunch(entry, { hubUrl: hubUrl(host, port) });
}

export function ensureSatelliteUnitFiles(host: string, port: number): boolean {
  const dir = serviceUnitDir();
  mkdirSync(dir, { recursive: true });
  let changed = false;
  for (const { name, config } of loadManagedSatellites()) {
    const launch = resolveLaunchForSatellite(config, host, port);
    const content = renderSatelliteSystemdUnit(name, launch);
    const path = satelliteUnitPath(name);
    if (!existsSync(path) || readFileSync(path, "utf-8") !== content) {
      writeFileSync(path, content, "utf-8");
      changed = true;
    }
  }
  return changed;
}

export function startManagedSatellitesViaSystemd(host: string, port: number): void {
  if (!systemdUserAvailable()) return;
  const list = loadManagedSatellites();
  if (list.length === 0) return;

  ensureSatelliteUnitFiles(host, port);
  systemctl("daemon-reload");

  for (const { name } of list) {
    const unit = satelliteSystemdUnitName(name);
    const r = systemctl("enable", "--now", unit);
    if (r.status !== 0) {
      writeStatusLine("warning", `Satellite ${name} start failed: ${r.stderr || r.stdout}`);
      continue;
    }
    writeStatusLine("ok", `Satellite ${name} started (systemd ${unit})`);
  }
}

export function stopManagedSatellitesViaSystemd(): void {
  if (!systemdUserAvailable()) return;
  for (const { name } of loadManagedSatellites()) {
    const unit = satelliteSystemdUnitName(name);
    systemctl("stop", unit);
    writeStatusLine("info", `Satellite ${name} stopped (systemd ${unit})`);
  }
}

function spawnSatellite(
  name: string,
  launch: SatelliteLaunch,
  opts?: { foreground?: boolean },
): void {
  const child = spawn(launch.command, launch.args, {
    cwd: launch.workingDirectory,
    env: { ...process.env, ...launch.environment },
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

  console.log(`Satellite ${name} started (PID ${child.pid})`);
}

export function startAllSatellites(opts?: {
  foreground?: boolean;
  host?: string;
  port?: number;
  useSystemd?: boolean;
}): void {
  const host = opts?.host ?? "127.0.0.1";
  const port = opts?.port ?? 2658;
  const useSystemd = opts?.useSystemd ?? (systemdUserAvailable() && !opts?.foreground);

  if (useSystemd) {
    startManagedSatellitesViaSystemd(host, port);
    return;
  }

  const list = loadManagedSatellites();
  if (list.length === 0) return;
  for (const { name, config } of list) {
    const launch = resolveLaunchForSatellite(config, host, port);
    spawnSatellite(name, launch, opts);
  }
}

/** 前台模式 spawn 的 satellite 子进程（非 systemd 托管） */
export function stopForegroundSatellites(): void {
  for (const [name, child] of foregroundChildren) {
    try {
      process.kill(child.pid ?? 0, "SIGTERM");
    } catch {
      /* already dead */
    }
    foregroundChildren.delete(name);
  }
}

export function stopAllSatellites(opts?: { skipSystemd?: boolean }): void {
  stopForegroundSatellites();
  if (!opts?.skipSystemd) {
    stopManagedSatellitesViaSystemd();
  }
}

export function stopSatellitesBeforeExit(): void {
  stopAllSatellites();
}
