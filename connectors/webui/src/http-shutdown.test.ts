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

  it("waitForDrainWithTimeout 超时后继续", async () => {
    vi.useFakeTimers();
    const anima = {
      getInFlightCount: () => 2,
      waitForDrain: () => new Promise<void>(() => {}),
    };
    const p = waitForDrainWithTimeout(anima as never, 1000);
    vi.advanceTimersByTime(1000);
    await p;
    vi.useRealTimers();
  });
});
