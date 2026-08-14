import { mkdirSync, unlinkSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "@freeanima/habitat/platform/config";
import { logComponent } from "@freeanima/habitat/platform/logging";
import { ANIMA_VERSION } from "../service/version.ts";
import { SERVICE_BUILD_META } from "../service/service-build-meta.ts";

export function startupLog(message: string): void {
  logComponent("startup").debug(message);
}

/** 其它存活进程已占用 server.pid 时返回其 pid，否则 null */
export function liveForeignPid(): number | null {
  if (!existsSync(PATHS.pidFile)) return null;
  try {
    const listed = parseInt(readFileSync(PATHS.pidFile, "utf-8").trim(), 10);
    if (!Number.isFinite(listed) || listed === process.pid) return null;
    process.kill(listed, 0);
    return listed;
  } catch {
    return null;
  }
}

/**
 * 认领全局 server.pid：若已有存活外进程则不覆盖（支持同 home 多端口 dev:habitat）。
 * @returns 是否由本进程持有/写入了 pid 文件
 */
export function claimPidFileIfUnowned(): boolean {
  mkdirSync(dirname(PATHS.pidFile), { recursive: true });
  const foreign = liveForeignPid();
  if (foreign != null) {
    startupLog(`server.pid owned by live pid ${foreign}; not overwriting`);
    return false;
  }
  writeFileSync(PATHS.pidFile, String(process.pid));
  return true;
}

export function writeStatusFile(
  host: string,
  port: number,
  phase: "starting" | "ready" = "ready",
  tlsPort?: number | null,
): void {
  const foreign = liveForeignPid();
  if (foreign != null) {
    startupLog(`skip status file write; server.pid owned by live pid ${foreign}`);
    return;
  }

  const status: Record<string, unknown> = {
    pid: process.pid,
    version: ANIMA_VERSION,
    build: SERVICE_BUILD_META,
    start_time: Date.now() / 1000,
    host,
    port,
    phase,
  };
  if (tlsPort != null && tlsPort > 0) {
    status.tls_port = tlsPort;
  }
  mkdirSync(dirname(PATHS.statusFile), { recursive: true });
  writeFileSync(PATHS.statusFile, JSON.stringify(status, null, 2));
}

export function cleanStatusFile(): void {
  // 多前台实例可共用 ~/.anima：只清理「本进程」写入的 pid/status，避免误删其它实例元数据
  let pidMatches = false;
  try {
    if (existsSync(PATHS.pidFile)) {
      const listed = parseInt(readFileSync(PATHS.pidFile, "utf-8").trim(), 10);
      pidMatches = listed === process.pid;
    }
  } catch {
    /* ignore */
  }
  if (!pidMatches) {
    try {
      if (existsSync(PATHS.statusFile)) {
        const status = JSON.parse(readFileSync(PATHS.statusFile, "utf-8")) as { pid?: unknown };
        pidMatches = status.pid === process.pid;
      }
    } catch {
      /* ignore */
    }
  }
  if (!pidMatches) return;

  try {
    unlinkSync(PATHS.statusFile);
  } catch {
    /* ignore */
  }
  try {
    unlinkSync(PATHS.pidFile);
  } catch {
    /* ignore */
  }
}
