import { PATHS } from "@freeanima/habitat/platform/config";
import { asRecord } from "@freeanima/shared/util";
import { existsSync, readFileSync, unlinkSync } from "node:fs";

export function readStatusFile(): Record<string, unknown> | null {
  if (!existsSync(PATHS.statusFile)) return null;
  try {
    return asRecord(JSON.parse(readFileSync(PATHS.statusFile, "utf-8")));
  } catch {
    return null;
  }
}

export function isServerAlive(): number | null {
  if (!existsSync(PATHS.pidFile)) return null;
  try {
    const pid = parseInt(readFileSync(PATHS.pidFile, "utf-8").trim(), 10);
    process.kill(pid, 0);
    return pid;
  } catch {
    try {
      unlinkSync(PATHS.pidFile);
    } catch {
      /* ignore */
    }
    return null;
  }
}
