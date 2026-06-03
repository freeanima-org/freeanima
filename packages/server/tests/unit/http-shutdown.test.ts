import { describe, it, expect, vi } from "bun:test";
import { EventEmitter } from "node:events";
import type { ServerType } from "@hono/node-server";
import { closeHttpServer, waitForDrainWithTimeout } from "../../src/http-shutdown";

function mockServer(opts?: { closeDelayMs?: number }): ServerType & {
  closeIdleConnections: ReturnType<typeof vi.fn>;
  closeAllConnections: ReturnType<typeof vi.fn>;
} {
  const emitter = new EventEmitter();
  const closeIdleConnections = vi.fn();
  const closeAllConnections = vi.fn();
  const server = Object.assign(emitter, {
    close(cb: () => void) {
      const delay = opts?.closeDelayMs ?? 0;
      if (delay <= 0) {
        cb();
        return;
      }
      setTimeout(cb, delay);
    },
    closeIdleConnections,
    closeAllConnections,
  }) as ServerType & {
    closeIdleConnections: ReturnType<typeof vi.fn>;
    closeAllConnections: ReturnType<typeof vi.fn>;
  };
  return server;
}

describe("http-shutdown", () => {
  it("closeHttpServer 在 close 回调时立即完成", async () => {
    const server = mockServer();
    await closeHttpServer(server, 50);
    expect(server.closeIdleConnections).toHaveBeenCalled();
  });

  it("closeHttpServer 超时后强制断开", async () => {
    vi.useFakeTimers();
    const server = mockServer({ closeDelayMs: 10_000 });
    const p = closeHttpServer(server, 100);
    vi.advanceTimersByTime(100);
    await p;
    expect(server.closeAllConnections).toHaveBeenCalled();
    vi.useRealTimers();
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
