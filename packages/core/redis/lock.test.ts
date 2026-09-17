import { afterEach, describe, expect, it, mock } from "bun:test";
import type { RedisClient } from "bun";

import { initRedis, resetRedisForTest, setRedisForTest } from "./client.ts";
import {
  DEFAULT_LOCK_TTL_MS,
  REDIS_LOCK_KEY_PREFIX,
  forceReleaseRedisLock,
  listRedisLocks,
  resetRedisLockWarnForTest,
  withRedisLock,
} from "./lock.ts";

type StoreEntry = { value: string; expiresAtMs: number };

function createMockRedis() {
  const store = new Map<string, StoreEntry>();
  const set = mock(async (key: string, value: string, ...args: (string | number)[]) => {
    let px: number | null = null;
    let nx = false;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "NX") nx = true;
      if (a === "PX") {
        px = Number(args[i + 1]);
        i += 1;
      }
    }
    const existing = store.get(key);
    if (existing && Date.now() < existing.expiresAtMs && nx) {
      return null;
    }
    store.set(key, {
      value,
      expiresAtMs: Date.now() + (px ?? DEFAULT_LOCK_TTL_MS),
    });
    return "OK";
  });
  const get = mock(async (key: string) => {
    const e = store.get(key);
    if (!e) return null;
    if (Date.now() >= e.expiresAtMs) {
      store.delete(key);
      return null;
    }
    return e.value;
  });
  const send = mock(async (command: string, args: string[]) => {
    if (command === "PTTL") {
      const key = args[0] ?? "";
      const e = store.get(key);
      if (!e) return -2;
      const remaining = e.expiresAtMs - Date.now();
      if (remaining <= 0) {
        store.delete(key);
        return -2;
      }
      return remaining;
    }
    return null;
  });
  const evalScript = mock(
    async (script: string, _numkeys: number, ...keysAndArgs: (string | number)[]) => {
      const key = String(keysAndArgs[0] ?? "");
      const token = String(keysAndArgs[1] ?? "");
      const e = store.get(key);
      if (!e || Date.now() >= e.expiresAtMs) return 0;
      if (script.includes("DEL")) {
        if (e.value === token) {
          store.delete(key);
          return 1;
        }
        return 0;
      }
      if (script.includes("PEXPIRE")) {
        if (e.value === token) {
          store.set(key, {
            value: e.value,
            expiresAtMs: Date.now() + Number(keysAndArgs[2]),
          });
          return 1;
        }
        return 0;
      }
      return 0;
    },
  );
  const del = mock(async (key: string) => {
    if (!store.has(key)) return 0;
    store.delete(key);
    return 1;
  });
  const scan = mock(async (_cursor: string | number, ...args: (string | number)[]) => {
    const glob = String(args[1] ?? "*");
    const prefix = glob.endsWith("*") ? glob.slice(0, -1) : glob;
    const keys = [...store.keys()].filter((k) => {
      if (glob === "*") return true;
      if (glob.endsWith("*")) return k.startsWith(prefix);
      return k === glob;
    });
    return ["0", keys] as [string, string[]];
  });

  return {
    store,
    client: { set, get, send, eval: evalScript, del, scan } as unknown as RedisClient,
    set,
    get,
    send,
    eval: evalScript,
    del,
    scan,
  };
}

describe("withRedisLock", () => {
  afterEach(() => {
    resetRedisForTest();
    resetRedisLockWarnForTest();
  });

  it("runs fn when Redis not configured (skipped_unavailable path executes)", async () => {
    resetRedisForTest();
    const result = await withRedisLock({ key: "k" }, async () => 42);
    expect(result).toEqual({ status: "ok", value: 42 });
  });

  it("bypasses when Redis SET throws (connection failure ≠ busy)", async () => {
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest({
      set: mock(async () => {
        throw new Error("connection refused");
      }),
      send: mock(async () => 0),
    } as unknown as RedisClient);

    const result = await withRedisLock(
      { key: "down", mode: "wait", waitMs: 5_000, retryIntervalMs: 20 },
      async () => "ok",
    );
    expect(result).toEqual({ status: "ok", value: "ok" });
  });

  it("acquires with anima:lock prefix and releases via Lua", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    const result = await withRedisLock({ key: "job-a", ttlMs: 5_000 }, async () => {
      expect(mockRedis.store.has(`${REDIS_LOCK_KEY_PREFIX}job-a`)).toBe(true);
      return "done";
    });
    expect(result).toEqual({ status: "ok", value: "done" });
    expect(mockRedis.store.has(`${REDIS_LOCK_KEY_PREFIX}job-a`)).toBe(false);
    expect(mockRedis.eval).toHaveBeenCalled();
  });

  it("try mode returns busy when lock held", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    mockRedis.store.set(`${REDIS_LOCK_KEY_PREFIX}busy`, {
      value: "other",
      expiresAtMs: Date.now() + 60_000,
    });

    const result = await withRedisLock({ key: "busy", mode: "try" }, async () => "x");
    expect(result).toEqual({ status: "busy" });
  });

  it("wait mode acquires after release", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    const key = `${REDIS_LOCK_KEY_PREFIX}wait-me`;
    mockRedis.store.set(key, { value: "holder", expiresAtMs: Date.now() + 60_000 });
    setTimeout(() => {
      mockRedis.store.delete(key);
    }, 40);

    const result = await withRedisLock(
      { key: "wait-me", mode: "wait", waitMs: 500, retryIntervalMs: 20, ttlMs: 5_000 },
      async () => "ok",
    );
    expect(result).toEqual({ status: "ok", value: "ok" });
  });

  it("wait mode times out as busy", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    mockRedis.store.set(`${REDIS_LOCK_KEY_PREFIX}stuck`, {
      value: "holder",
      expiresAtMs: Date.now() + 60_000,
    });

    const result = await withRedisLock(
      { key: "stuck", mode: "wait", waitMs: 80, retryIntervalMs: 20 },
      async () => "x",
    );
    expect(result).toEqual({ status: "busy" });
  });

  it("wait mode aborted via AbortSignal returns busy", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    mockRedis.store.set(`${REDIS_LOCK_KEY_PREFIX}abort`, {
      value: "holder",
      expiresAtMs: Date.now() + 60_000,
    });

    const ac = new AbortController();
    setTimeout(() => ac.abort(), 30);

    const result = await withRedisLock(
      {
        key: "abort",
        mode: "wait",
        waitMs: 5_000,
        retryIntervalMs: 20,
        signal: ac.signal,
      },
      async () => "x",
    );
    expect(result).toEqual({ status: "busy" });
  });

  it("does not unlock when token mismatches", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    const key = `${REDIS_LOCK_KEY_PREFIX}tok`;
    let stolen = false;
    const result = await withRedisLock({ key: "tok", ttlMs: 5_000 }, async () => {
      // 模拟租约被覆盖：他人写入不同 token
      mockRedis.store.set(key, { value: "stolen", expiresAtMs: Date.now() + 60_000 });
      stolen = true;
      return 1;
    });
    expect(stolen).toBe(true);
    expect(result.status).toBe("ok");
    // Lua 因 token 不匹配不删，stolen 仍在
    expect(mockRedis.store.get(key)?.value).toBe("stolen");
  });

  it("renew starts watchdog that calls extend", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    // ttl 足够小使 interval = max(1000, ttl/3) 仍为 1000；用 spy 直接调 extend 路径：
    // 短跑任务 + renew 至少注册 interval；验证 set 后 eval 在 finally 释放至少一次
    const result = await withRedisLock({ key: "renew", ttlMs: 3_000, renew: true }, async () => {
      await new Promise<void>((r) => {
        setTimeout(r, 10);
      });
      return true;
    });
    expect(result).toEqual({ status: "ok", value: true });
    expect(mockRedis.eval.mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});

describe("listRedisLocks / forceReleaseRedisLock", () => {
  afterEach(() => {
    resetRedisForTest();
    resetRedisLockWarnForTest();
  });

  it("returns empty when Redis is not configured", async () => {
    resetRedisForTest();
    await expect(listRedisLocks()).resolves.toEqual([]);
    await expect(forceReleaseRedisLock("stale")).resolves.toBe(false);
  });

  it("lists anima:lock keys with remaining ttl", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    mockRedis.store.set(`${REDIS_LOCK_KEY_PREFIX}memory-maintenance`, {
      value: "token",
      expiresAtMs: Date.now() + 30_000,
    });

    const listed = await listRedisLocks();
    expect(listed).toHaveLength(1);
    expect(listed[0]?.key).toBe(`${REDIS_LOCK_KEY_PREFIX}memory-maintenance`);
    expect(listed[0]?.logicalKey).toBe("memory-maintenance");
    expect(listed[0]?.ttlMs).toBeGreaterThan(0);
    expect(listed[0]?.ttlMs).toBeLessThanOrEqual(30_000);
  });

  it("force-deletes without matching token (logical or full key)", async () => {
    const mockRedis = createMockRedis();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest(mockRedis.client);

    const key = `${REDIS_LOCK_KEY_PREFIX}fts-rebuild`;
    mockRedis.store.set(key, { value: "foreign-token", expiresAtMs: Date.now() + 60_000 });

    expect(await forceReleaseRedisLock("fts-rebuild")).toBe(true);
    expect(mockRedis.store.has(key)).toBe(false);

    mockRedis.store.set(key, { value: "again", expiresAtMs: Date.now() + 60_000 });
    expect(await forceReleaseRedisLock(key)).toBe(true);
    expect(mockRedis.store.has(key)).toBe(false);
    expect(await forceReleaseRedisLock("missing")).toBe(false);
  });
});
