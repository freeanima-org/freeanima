import { describe, it, expect, vi, beforeEach, afterEach } from "bun:test";
import { closeHttpServers, waitForDrainWithTimeout } from "../../src/http-shutdown";
import type { WebuiServerHandle } from "../../src/webui-server";
import { beginLogIsolation, endLogIsolation } from "../../../../tests/helpers/log-isolation";

const prevHome = process.env.FREEANIMA_HOME;
beforeEach(() => {
  beginLogIsolation("freeanima-http-shutdown-");
});
afterEach(() => {
  endLogIsolation(prevHome);
});

function mockHandle(): WebuiServerHandle {
  return {
    server: {} as WebuiServerHandle["server"],
    bunDev: null,
    close: vi.fn(),
  };
}

describe("http-shutdown", () => {
  it("closeHttpServers 关闭全部 WebUI 句柄", async () => {
    const a = mockHandle();
    const b = mockHandle();
    await closeHttpServers([a, b]);
    expect(a.close).toHaveBeenCalled();
    expect(b.close).toHaveBeenCalled();
  });

  it("waitForDrainWithTimeout 超时后继续", async () => {
    vi.useFakeTimers();
    const nest = {
      getInFlightCount: () => 2,
      waitForDrain: () => new Promise<void>(() => {}),
    };
    const p = waitForDrainWithTimeout(nest as never, 1000);
    vi.advanceTimersByTime(1000);
    await p;
    vi.useRealTimers();
  });
});
