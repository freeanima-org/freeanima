import { describe, expect, it, mock } from "bun:test";
import type { SQL } from "bun";

import { drainPoolWithRollback, runPoolHealTick } from "./pool-heal.ts";

function mockMonitor(rows: Array<{ n: number }>): SQL {
  const fn = mock(async () => rows);
  return fn as unknown as SQL;
}

describe("drainPoolWithRollback", () => {
  it("reserves up to max, rolls back, and always releases", async () => {
    const released: number[] = [];
    const rollbacks: number[] = [];
    let nextId = 0;

    const pool = {
      reserve: mock(async () => {
        const id = nextId;
        nextId += 1;
        return {
          unsafe: mock(async () => {
            rollbacks.push(id);
          }),
          release: mock(() => {
            released.push(id);
          }),
        };
      }),
    } as unknown as SQL;

    const rolled = await drainPoolWithRollback(pool, 3);
    expect(rolled).toBe(3);
    expect(rollbacks).toEqual([0, 1, 2]);
    expect(released).toEqual([0, 1, 2]);
  });

  it("releases even when ROLLBACK throws", async () => {
    const released: string[] = [];
    const pool = {
      reserve: mock(async () => ({
        unsafe: mock(async () => {
          throw new Error("already aborted");
        }),
        release: mock(() => {
          released.push("ok");
        }),
      })),
    } as unknown as SQL;

    const rolled = await drainPoolWithRollback(pool, 1);
    expect(rolled).toBe(0);
    expect(released).toEqual(["ok"]);
  });
});

describe("runPoolHealTick", () => {
  it("skips when pool missing", async () => {
    const result = await runPoolHealTick({
      getPool: () => null,
      createMonitor: () => {
        throw new Error("should not create monitor");
      },
      getPoolMax: () => 2,
    });
    expect(result).toEqual({ aborted: 0, rolled_back: 0, skipped: true });
  });

  it("does not drain when no aborted backends", async () => {
    const reserve = mock(async () => {
      throw new Error("should not reserve");
    });
    const result = await runPoolHealTick({
      getPool: () => ({ reserve }) as unknown as SQL,
      createMonitor: () => mockMonitor([{ n: 0 }]),
      getPoolMax: () => 2,
    });
    expect(result).toEqual({ aborted: 0, rolled_back: 0, skipped: false });
    expect(reserve).not.toHaveBeenCalled();
  });

  it("drains when aborted count > 0", async () => {
    const released: number[] = [];
    let nextId = 0;
    const pool = {
      reserve: mock(async () => {
        const id = nextId;
        nextId += 1;
        return {
          unsafe: mock(async () => undefined),
          release: mock(() => {
            released.push(id);
          }),
        };
      }),
    } as unknown as SQL;

    const result = await runPoolHealTick({
      getPool: () => pool,
      createMonitor: () => mockMonitor([{ n: 2 }]),
      getPoolMax: () => 2,
    });
    expect(result.skipped).toBe(false);
    expect(result.aborted).toBe(2);
    expect(result.rolled_back).toBe(2);
    expect(released).toEqual([0, 1]);
  });
});
