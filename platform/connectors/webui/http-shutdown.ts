import { logComponent } from "@freeanima/platform/logging";
import type { MessagingPort } from "@freeanima/platform/ports/ports/messaging-port";

/** 等待进行中的 engine 请求落盘；超时后继续关停，避免 systemd SIGKILL */
export async function waitForDrainWithTimeout(app: MessagingPort, maxMs: number): Promise<void> {
  await Promise.race([
    app.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = app.getInFlightCount();
        if (n > 0) {
          logComponent("shutdown").warn(`请求排空超时，仍有 ${n} 个进行中请求`, {
            max_ms: maxMs,
            in_flight: n,
          });
        }
        resolve();
      }, maxMs);
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
