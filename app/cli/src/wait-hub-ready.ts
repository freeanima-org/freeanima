import { apiGet, resolveProbeHost, serviceUnitPath, writeStatusLine } from "./service-common.ts";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { SYSTEMD_UNIT, systemdUserAvailable } from "./systemd-unit.ts";

export type WaitForHubReadyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function systemdHubFailed(): boolean {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return false;
  const r = spawnSync("systemctl", ["--user", "is-failed", SYSTEMD_UNIT], { encoding: "utf-8" });
  return String(r.stdout ?? "").trim() === "failed";
}

/** Poll GET /api/health until status is ok or timeout. */
export async function waitForHubReady(
  host: string,
  port: number,
  opts?: WaitForHubReadyOptions,
): Promise<boolean> {
  const timeoutMs = opts?.timeoutMs ?? 120_000;
  const intervalMs = opts?.intervalMs ?? 500;
  const probeHost = resolveProbeHost(host);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const health = await apiGet(probeHost, port, "/api/health", 2000);
    if (health?.status === "ok") return true;
    await sleep(intervalMs);
  }
  return false;
}

export async function waitForHubReadyOrWarn(host: string, port: number): Promise<boolean> {
  const timeoutMs = 120_000;
  const intervalMs = 500;
  const probeHost = resolveProbeHost(host);
  const deadline = Date.now() + timeoutMs;
  let waited = false;
  let lastProgressAt = 0;

  while (Date.now() < deadline) {
    const health = await apiGet(probeHost, port, "/api/health", 2000);
    if (health?.status === "ok") return true;

    if (systemdHubFailed()) {
      writeStatusLine("warning", "Hub 启动失败（systemd 报告 anima.service failed）");
      writeStatusLine("info", "See: journalctl --user -u anima -n 30 --no-pager");
      return false;
    }

    const now = Date.now();
    if (!waited) {
      writeStatusLine("info", "等待 Hub 就绪…");
      waited = true;
      lastProgressAt = now;
    } else if (now - lastProgressAt >= 5000) {
      const elapsed = Math.round((now - (deadline - timeoutMs)) / 1000);
      writeStatusLine("info", `仍在等待 Hub（${elapsed}s）…`);
      lastProgressAt = now;
    }

    await sleep(intervalMs);
  }

  writeStatusLine("warning", "Hub health check timed out; managed satellites not started");
  writeStatusLine("info", "Try: anima service restart");
  writeStatusLine("info", "See: journalctl --user -u anima -n 30 --no-pager");
  return false;
}
