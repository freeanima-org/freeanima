import { describe, it, expect, vi, afterEach } from "bun:test";
import { closeHttpServers, waitForDrainWithTimeout } from "./http-shutdown.ts";
import type { WebuiServerHandle } from "./webui-server.ts";
function mockHandle(): WebuiServerHandle {
  return {
    port: 2658,
    close: vi.fn(),
  };
}

describe("http-shutdown", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("closeHttpServers 关闭全部 WebUI 句柄", async () => {
    const a = mockHandle();
    const b = mockHandle();
    await closeHttpServers([a, b]);
    expect(a.close).toHaveBeenCalled();
    expect(b.close).toHaveBeenCalled();
  });

  it("waitForDrainWithTimeout 超时后 abort 并继续", async () => {
    vi.useFakeTimers();
    let drainCalls = 0;
    const anima = {
      getInFlightCount: () => 2,
      abortAll: vi.fn(),
      waitForDrain: () => {
        drainCalls++;
        if (drainCalls === 1) return new Promise<void>(() => {});
        return Promise.resolve();
      },
    };
    const p = waitForDrainWithTimeout(anima as never, 1000);
    vi.advanceTimersByTime(1000);
    await p;
    expect(anima.abortAll).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
