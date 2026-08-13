import { installErrorLogHandlers, logStartupError } from "@freeanima/host/platform/logging";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { isServerAlive, readStatusFile } from "@freeanima/host/platform/alive.ts";
import {
  apiGet,
  checkServerAlive,
  animaBin,
  resolveAnimaSpawn,
  LOG_FILE,
  prettyDuration,
  serviceUnitPath,
  serviceUnitDir,
  resolveProbeHost,
  readRecentErrorLogTail,
  writeStatusLine,
} from "./service-common.ts";

import { REPO_ROOT } from "@freeanima/host/platform";
import {
  renderSystemdUnit,
  systemdUserAvailable,
  SYSTEMD_UNIT,
  stopHubStackViaSystemd,
} from "./systemd-unit.ts";
import { printServiceRunningStatus } from "./output/service-status-display.ts";
import { waitForHabitatReadyOrWarn } from "./wait-habitat-ready.ts";
import { validateBootstrapOnStartup } from "@freeanima/host/platform/config";
import { runServiceStack } from "./stack/supervisor.ts";
import { probeWebHealth } from "./web/web-runtime.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export type ServiceArgs = {
  action: string;
  foreground: boolean;
  host: string;
  port: number;
};

function systemdFailed(): boolean {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return false;
  const r = systemctl("is-failed", SYSTEMD_UNIT);
  return String(r.stdout ?? "").trim() === "failed";
}

function printStartupErrorHints(): void {
  const lines = readRecentErrorLogTail(12);
  const startupLines = lines.filter(
    (l) =>
      l.includes("[startup]") ||
      l.includes("uncaughtException") ||
      l.includes("unhandledRejection"),
  );
  if (startupLines.length > 0) {
    writeStatusLine("warning", "Recent startup errors (error.log):");
    for (const line of startupLines.slice(-4)) console.log(`    ${line}`);
  } else if (lines.length > 0) {
    writeStatusLine("warning", "Recent error.log:");
    for (const line of lines.slice(-3)) console.log(`    ${line}`);
  }
}

const SYSTEMD_STARTING = new Set(["activating", "auto-restart", "reloading"]);

function systemctl(...args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync("systemctl", ["--user", ...args], { encoding: "utf-8" });
}

export function ensureUnitFile(host: string, port: number): boolean {
  const content = renderSystemdUnit(animaBin(), host, port);
  const dir = serviceUnitDir();
  const unitPath = serviceUnitPath();
  mkdirSync(dir, { recursive: true });
  if (existsSync(unitPath) && readFileSync(unitPath, "utf-8") === content) {
    return false;
  }
  writeFileSync(unitPath, content, "utf-8");
  return true;
}

function systemdState(): string | null {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return null;
  const r = systemctl("is-active", SYSTEMD_UNIT);
  return String(r.stdout ?? "").trim() || null;
}

function hostPort(statusFile: Record<string, unknown>, args: ServiceArgs): [string, number] {
  return [coerceString(statusFile.host ?? args.host), Number(statusFile.port ?? args.port)];
}

async function fetchHttpStatus(
  host: string,
  port: number,
): Promise<[boolean, Record<string, unknown> | null, number]> {
  const probeHost = resolveProbeHost(host);
  const t0 = performance.now();
  const health = await apiGet(probeHost, port, "/rpc/v1/health/probe", 2000);
  const ms = performance.now() - t0;
  if (!health || health.status !== "ok") return [false, null, ms];
  return [true, null, ms];
}

function printDeadStatus(statusFile: Record<string, unknown>): void {
  const startTime = statusFile.start_time_iso ?? "";
  const version = statusFile.version ?? "?";
  const startTs = Number(statusFile.start_time ?? 0);
  const phase = coerceString(statusFile.phase ?? "");
  let ranFor = "";
  if (startTs > 0) {
    const now = Date.now() / 1000;
    if (startTs < now) ranFor = ` (ran for ${prettyDuration(now - startTs)})`;
  }
  console.log("Free Anima · not running");
  if (startTs > 0) {
    const when = startTime || new Date(startTs * 1000).toISOString();
    console.log(`  last start: ${coerceString(when)}${ranFor}`);
  }
  console.log(`  version: ${coerceString(version)}`);
  if (phase === "starting") writeStatusLine("warning", "Exited before startup completed");
  else writeStatusLine("warning", "May have exited abnormally");
  console.log(`  log: ${LOG_FILE}`);
  printStartupErrorHints();
}

async function startDetachedWithoutSystemd(args: ServiceArgs): Promise<void> {
  const alive = isServerAlive();
  if (alive != null) {
    console.log(`Free Anima already running (PID ${alive})`);
    process.exit(1);
  }

  const { command, args: spawnArgs } = resolveAnimaSpawn([
    "service",
    "start",
    "--foreground",
    "--host",
    args.host,
    "--port",
    String(args.port),
  ]);
  const child = spawn(command, spawnArgs, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, FREEANIMA_REPO_ROOT: REPO_ROOT },
    cwd: REPO_ROOT,
  });
  child.unref();

  for (let i = 0; i < 30; i++) {
    await new Promise((res) => {
      setTimeout(res, 500);
    });
    const pid = isServerAlive();
    if (pid != null) {
      writeStatusLine("ok", `Started in background (PID ${pid})`);
      writeStatusLine("info", "systemd --user not detected, using detached process");
      console.log(`  address: http://${args.host}:${args.port}`);
      console.log("  status: anima service status");
      console.log("  stop: anima service stop");
      return;
    }
  }

  console.error("Startup timeout: no PID detected; check error.log or use --foreground to debug");
  process.exit(1);
}

async function cmdServiceStatus(args: ServiceArgs): Promise<void> {
  const statusFile = readStatusFile() ?? {};
  const [host, port] = hostPort(statusFile, args);
  const sd = systemdState();

  const [httpUp, body, healthMs] = await fetchHttpStatus(host, port);
  const pid = isServerAlive();

  if (httpUp) {
    const webUp = await probeWebHealth(resolveProbeHost(host), port);
    printServiceRunningStatus({
      body,
      statusFile,
      host,
      port,
      tlsPort:
        (statusFile.tls_port as number | undefined) ??
        (body?.tls_port as number | undefined) ??
        null,
      healthMs,
      systemd: sd,
      pidOverride: pid,
      web: {
        running: webUp,
        host: resolveProbeHost(host),
        port,
      },
    });
    return;
  }

  if (pid != null) {
    const startTs = Number(statusFile.start_time ?? 0);
    const startingFor = startTs > 0 ? Date.now() / 1000 - startTs : 0;
    console.log(`Free Anima · starting (PID ${pid})`);
    if (startingFor > 120) {
      writeStatusLine(
        "warning",
        `HTTP not ready for ${prettyDuration(startingFor)}, may be stuck during startup`,
      );
      writeStatusLine("info", "Try: anima service stop && anima service start --foreground");
    } else {
      writeStatusLine("warning", "HTTP not ready; may still be starting or port not listening");
    }
    if (sd && SYSTEMD_STARTING.has(sd)) writeStatusLine("info", `systemd: ${sd}`);
    printStartupErrorHints();
    return;
  }

  if (sd && SYSTEMD_STARTING.has(sd)) {
    console.log("Free Anima · starting…");
    if (sd) writeStatusLine("info", `systemd: ${sd}`);
    return;
  }

  if (systemdFailed()) {
    console.log("Free Anima · not running");
    writeStatusLine("warning", "systemd reports anima.service failed to start");
    writeStatusLine("info", "See: journalctl --user -u anima -n 30 --no-pager");
    console.log(`  log: ${LOG_FILE}`);
    printStartupErrorHints();
    return;
  }

  if (statusFile.start_time) {
    printDeadStatus(statusFile);
    return;
  }

  console.log("Free Anima · not running");
  printStartupErrorHints();
  console.log("  start: anima service start");
  console.log("  debug: anima service start --foreground");
}

export async function runServiceCommand(args: ServiceArgs): Promise<void> {
  const action = args.action || "start";

  if (action === "start") {
    if (args.foreground) {
      if (isServerAlive()) {
        console.log(`Free Anima already running (PID ${isServerAlive()})`);
        process.exit(1);
      }
      console.log("Free Anima · starting in foreground…");
      installErrorLogHandlers();
      try {
        await runServiceStack({ host: args.host, port: args.port });
      } catch (e) {
        logStartupError("Service startup failed", e);
        process.exit(1);
      }
      return;
    }

    if (!systemdUserAvailable()) {
      await validateBootstrapOnStartup();
      await startDetachedWithoutSystemd(args);
      await waitForHabitatReadyOrWarn(args.host, args.port);
      return;
    }

    await validateBootstrapOnStartup();
    ensureUnitFile(args.host, args.port);
    systemctl("daemon-reload");
    const r = systemctl("enable", "--now", SYSTEMD_UNIT);
    if (r.status !== 0) {
      console.error(`Startup failed: ${String(r.stderr || r.stdout)}`);
      process.exit(1);
    }
    writeStatusLine("ok", "Started via systemd");
    console.log(`  unit: ${serviceUnitPath()}`);
    console.log(`  address: http://${args.host}:${args.port}`);
    console.log("  status: anima service status");
    await waitForHabitatReadyOrWarn(args.host, args.port);
    return;
  }

  if (action === "stop") {
    if (systemdUserAvailable() && existsSync(serviceUnitPath())) {
      writeStatusLine("info", "Stopping stack…");
      const r = stopHubStackViaSystemd();
      if (r?.status === 0) {
        console.log("Free Anima stopped (systemd)");
        return;
      }
    }
    const pid = checkServerAlive();
    if (pid == null) {
      console.log("Free Anima not running");
      return;
    }
    process.kill(pid, "SIGTERM");
    for (let i = 0; i < 10; i++) {
      await new Promise((res) => {
        setTimeout(res, 300);
      });
      if (checkServerAlive() == null) {
        console.log(`Free Anima (PID ${pid}) stopped`);
        return;
      }
    }
    console.log(`Free Anima (PID ${pid}) sent SIGTERM, wait timed out`);
    return;
  }

  if (action === "restart") {
    if (systemdUserAvailable() && existsSync(serviceUnitPath())) {
      ensureUnitFile(args.host, args.port);
      systemctl("daemon-reload");
      const r = systemctl("restart", SYSTEMD_UNIT);
      if (r.status === 0) {
        await waitForHabitatReadyOrWarn(args.host, args.port);
        writeStatusLine("ok", "Restarted (systemd)");
        return;
      }
    }
    await runServiceCommand({ ...args, action: "stop" });
    await runServiceCommand({ ...args, action: "start", foreground: false });
    return;
  }

  if (action === "status") {
    await cmdServiceStatus(args);
    return;
  }

  console.error(`Unknown action: ${action}`);
  process.exit(1);
}

/** For tests: probe whether service is HTTP reachable */
export async function probeService(
  host: string,
  port: number,
): Promise<"up" | "pid_only" | "down"> {
  const [httpUp] = await fetchHttpStatus(host, port);
  if (httpUp) return "up";
  if (isServerAlive() != null) return "pid_only";
  return "down";
}
