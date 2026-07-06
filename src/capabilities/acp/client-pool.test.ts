import { describe, it, expect } from "bun:test";
import { AcpClientPool, type AcpClientFactory } from "./client-pool.ts";
import type { ACPClient } from "./client.ts";

function mockClient(): ACPClient {
  let alive = true;
  return {
    abortActivePrompt: () => {},
    stop: () => {
      alive = false;
    },
    get isConnected() {
      return alive;
    },
    isProcessAlive: () => alive,
  } as unknown as ACPClient;
}

describe("AcpClientPool", () => {
  it("acquires and releases slots", async () => {
    let created = 0;
    const factory: AcpClientFactory = async () => {
      created++;
      return mockClient();
    };
    const pool = new AcpClientPool(2, factory);
    const a = await pool.tryAcquire("t1");
    const b = await pool.tryAcquire("t2");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(await pool.tryAcquire("t3")).toBeNull();
    pool.release(a!);
    const c = await pool.tryAcquire("t3");
    expect(c).not.toBeNull();
    expect(created).toBe(2);
  });

  it("abortPrompt only affects leased client", async () => {
    let aborted = 0;
    const factory: AcpClientFactory = async () =>
      ({
        abortActivePrompt: () => {
          aborted++;
        },
        stop: () => {},
        isConnected: true,
        isProcessAlive: () => true,
      }) as unknown as ACPClient;
    const pool = new AcpClientPool(1, factory);
    const lease = await pool.tryAcquire("t1");
    pool.abortPrompt(lease!);
    expect(aborted).toBe(1);
  });
});
