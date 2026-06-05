import { logComponent } from "@freeanima/legacy-kernel";
import type { NestService } from "@freeanima/legacy-runtime";
import type { WebuiServerHandle } from "./webui-server.ts";

/** 等待进行中的 engine 请求落盘；超时后继续关停，避免 systemd SIGKILL */
export async function waitForDrainWithTimeout(nest: NestService, maxMs: number): Promise<void> {
  await Promise.race([
    nest.waitForDrain(),
    new Promise<void>((resolve) => {
      setTimeout(() => {
        const n = nest.getInFlightCount();
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
  handles: WebuiServerHandle[],
  _timeoutMs = 3000,
): Promise<void> {
  await Promise.all(handles.map((h) => Promise.resolve(h.close())));
}
