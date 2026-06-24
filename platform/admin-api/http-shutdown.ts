import { logComponent } from "@freeanima/platform/logging";
import type { MessagingPort } from "@freeanima/platform/ports/ports/messaging-port";

/** 关停时等待 engine 排空的最短时长（避免 dev 重启时过短超时） */
export const MIN_GRACEFUL_DRAIN_MS = 15_000;

/** 等待进行中的 engine 请求落盘；超时后继续关停，避免 systemd SIGKILL */
export async function waitForDrainWithTimeout(app: MessagingPort, maxMs: number): Promise<void> {
  const drainMs = Math.max(maxMs, MIN_GRACEFUL_DRAIN_MS);
  await Promise.race([
    app.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = app.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(`请求排空超时，仍有 ${n} 个进行中请求`, {
            max_ms: drainMs,
            in_flight: n,
          });
        }
        resolve();
      }, drainMs);
    }),
  ]);
  if (app.getInFlightCount() > 0) {
    app.abortAll();
    await app.waitForDrain();
  }
}

type ClosableHandle = {
  close: () => void | Promise<void>;
};

export async function closeHttpServers(
  handles: ClosableHandle[],
  _timeoutMs = 3000,
): Promise<void> {
  await Promise.all(handles.map((h) => Promise.resolve(h.close())));
}
