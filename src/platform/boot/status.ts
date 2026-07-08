import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PATHS } from "@freeanima/platform/config";
import { logComponent } from "@freeanima/platform/logging";
import { ANIMA_VERSION } from "../runtime/version.ts";
import { SERVICE_BUILD_META } from "../runtime/service-build-meta.ts";

export function startupLog(message: string): void {
  logComponent("startup").debug(message);
}

export function writeStatusFile(
  host: string,
  port: number,
  phase: "starting" | "ready" = "ready",
): void {
  const status = {
    pid: process.pid,
    version: ANIMA_VERSION,
    build: SERVICE_BUILD_META,
    start_time: Date.now() / 1000,
    host,
    port,
    phase,
  };
  mkdirSync(dirname(PATHS.statusFile), { recursive: true });
  writeFileSync(PATHS.statusFile, JSON.stringify(status, null, 2));
}

export function cleanStatusFile(): void {
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
