import { apiGet, resolveProbeHost, writeStatusLine } from "./service-common.ts";

export type WaitForHubReadyOptions = {
  timeoutMs?: number;
  intervalMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  const ok = await waitForHubReady(host, port);
  if (!ok) {
    writeStatusLine("warning", "Hub health check timed out; managed satellites not started");
    writeStatusLine("info", "Try: anima service restart");
    writeStatusLine("info", "See: journalctl --user -u anima -n 30 --no-pager");
  }
  return ok;
}
