import { afterEach, describe, expect, it } from "bun:test";
import type { RedisClient } from "bun";
import { initRedis, resetRedisForTest, setRedisForTest } from "../../src/client.ts";
import { redisDel, redisGet, redisScanEntries, redisSet } from "../../src/kv.ts";

describe("redis KV", () => {
  afterEach(() => {
    resetRedisForTest();
  });

  it("未 initRedis 时静默降级", async () => {
    resetRedisForTest();
    await expect(redisSet("k", "v", 60)).resolves.toBeUndefined();
    await expect(redisGet("k")).resolves.toBeNull();
    await expect(redisDel("k")).resolves.toBeUndefined();
    await expect(redisScanEntries("fridge:*")).resolves.toEqual([]);
  });

  it("setex/get/del/scan 走 Bun 客户端", async () => {
    const store = new Map<string, string>();
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest({
      setex: async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
        return "OK";
      },
      get: async (key: string) => store.get(key) ?? null,
      del: async (key: string) => {
        store.delete(key);
        return 1;
      },
      scan: async (cursor: string | number, ...args: (string | number)[]) => {
        const pattern = String(args[1] ?? "*").replace("*", ".*");
        const re = new RegExp(`^${pattern}$`);
        const keys = [...store.keys()].filter((k) => re.test(k));
        return [cursor === "0" || cursor === 0 ? "0" : "0", keys] as [string, string[]];
      },
    } as unknown as RedisClient);

    await redisSet("fridge:session:a:b", "hello", 60);
    expect(await redisGet("fridge:session:a:b")).toBe("hello");
    expect(await redisScanEntries("fridge:session:*")).toEqual([
      { key: "fridge:session:a:b", value: "hello" },
    ]);
    await redisDel("fridge:session:a:b");
    expect(await redisGet("fridge:session:a:b")).toBeNull();
  });
});
