import { afterEach, describe, expect, it } from "bun:test";
import type { RedisClient } from "bun";
import { initRedis, resetRedisForTest, setRedisForTest } from "./client.ts";
import {
  cacheGet,
  cacheGetJson,
  cacheSet,
  cacheSetJson,
  resetCacheMemoryForTests,
} from "./cache.ts";

describe("redis cache", () => {
  afterEach(() => {
    resetRedisForTest();
    resetCacheMemoryForTests();
  });

  it("requires positive TTL", async () => {
    await expect(cacheSet("k", "v", 0)).rejects.toThrow(/ttlSeconds/);
  });

  it("memory bypass when Redis not configured", async () => {
    resetRedisForTest();
    await cacheSet("anima:cache:t", "hello", 60);
    expect(await cacheGet("anima:cache:t")).toBe("hello");
    expect(await cacheGetJson<{ n: number }>("anima:cache:j")).toBeNull();
    await cacheSetJson("anima:cache:j", { n: 1 }, 60);
    expect(await cacheGetJson<{ n: number }>("anima:cache:j")).toEqual({ n: 1 });
  });

  it("writes Redis when configured and still fills memory", async () => {
    const store = new Map<string, string>();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest({
      setex: async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
        return "OK";
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async () => 1,
      set: async () => "OK",
      scan: async () => ["0", []] as [string, string[]],
    } as unknown as RedisClient);

    await cacheSet("anima:cache:x", "from-redis", 30);
    expect(store.get("anima:cache:x")).toBe("from-redis");
    expect(await cacheGet("anima:cache:x")).toBe("from-redis");
  });
});
