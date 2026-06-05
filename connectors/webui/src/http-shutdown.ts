import { logComponent } from "@freeanima/service-logging";
import type { AnimaService } from "@freeanima/service";

type ClosableHandle = {
  close: () => void | Promise<void>;
};

/** 等待进行中的 engine 请求落盘；超时后继续关停，避免 systemd SIGKILL */
export async function waitForDrainWithTimeout(anima: AnimaService, maxMs: number): Promise<void> {
  await Promise.race([
    anima.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = anima.getInFlightCount();
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
}

export async function closeHttpServers(
  handles: ClosableHandle[],
  _timeoutMs = 3000,
): Promise<void> {
  await Promise.all(handles.map((h) => Promise.resolve(h.close())));
}
