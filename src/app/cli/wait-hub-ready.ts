import { apiGet, resolveProbeHost, serviceUnitPath, writeStatusLine } from "./service-common.ts";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { SYSTEMD_UNIT, systemdUserAvailable } from "./systemd-unit.ts";

export type WaitForHubReadyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

/** 启动探活默认 15min：慢迁移（HNSW / 记忆 backfill）常超过旧的 2min 窗口 */
export const DEFAULT_HUB_READY_TIMEOUT_MS = 900_000;

function resolveHubReadyTimeoutMs(override?: number): number {
  if (typeof override === "number" && Number.isFinite(override) && override > 0) return override;
  const raw = Number.parseInt(process.env.FREEANIMA_HUB_READY_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(raw) && raw > 0) return raw;
  return DEFAULT_HUB_READY_TIMEOUT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function systemdHubFailed(): boolean {
  if (!systemdUserAvailable() || !existsSync(serviceUnitPath())) return false;
  const r = spawnSync("systemctl", ["--user", "is-failed", SYSTEMD_UNIT], { encoding: "utf-8" });
  return String(r.stdout ?? "").trim() === "failed";
}

/** Poll GET /rpc/v1/health/probe until status is ok or timeout. */
export async function waitForHubReady(
  host: string,
  port: number,
  opts?: WaitForHubReadyOptions,
): Promise<boolean> {
  const timeoutMs = resolveHubReadyTimeoutMs(opts?.timeoutMs);
  const intervalMs = opts?.intervalMs ?? 500;
  const probeHost = resolveProbeHost(host);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const health = await apiGet(probeHost, port, "/rpc/v1/health/probe", 2000);
    if (health?.status === "ok") return true;
    await sleep(intervalMs);
  }
  return false;
}

export async function waitForHubReadyOrWarn(host: string, port: number): Promise<boolean> {
  const timeoutMs = resolveHubReadyTimeoutMs();
  const intervalMs = 500;
  const probeHost = resolveProbeHost(host);
  const deadline = Date.now() + timeoutMs;
  let waited = false;
  let lastProgressAt = 0;

  while (Date.now() < deadline) {
    const health = await apiGet(probeHost, port, "/rpc/v1/health/probe", 2000);
    if (health?.status === "ok") return true;

    if (systemdHubFailed()) {
      writeStatusLine("warning", "Habitat 启动失败（systemd 报告 anima.service failed）");
      writeStatusLine("info", "See: journalctl --user -u anima -n 30 --no-pager");
      return false;
    }

    const now = Date.now();
    if (!waited) {
      writeStatusLine("info", "等待 Habitat 就绪（含数据库迁移）…");
      waited = true;
      lastProgressAt = now;
    } else if (now - lastProgressAt >= 5000) {
      const elapsed = Math.round((now - (deadline - timeoutMs)) / 1000);
      writeStatusLine("info", `仍在等待 Habitat（${elapsed}s）…`);
      lastProgressAt = now;
    }

    await sleep(intervalMs);
  }

  writeStatusLine(
    "warning",
    `Habitat 在 ${Math.round(timeoutMs / 1000)}s 内未就绪（可能仍在跑迁移，或已退出）`,
  );
  writeStatusLine("info", "Check: journalctl --user -u anima -n 50 --no-pager");
  writeStatusLine("info", "Check: anima service status");
  writeStatusLine("info", "Try: anima service restart（勿在迁移进行中 stop）");
  return false;
}
