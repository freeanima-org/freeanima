import { afterEach, describe, expect, it } from "bun:test";
import type { RedisClient } from "bun";
import { initRedis, resetRedisForTest, setRedisForTest } from "./client.ts";
import { redisDel, redisGet, redisScanEntries, redisSet } from "./kv.ts";

describe("redis KV", () => {
  afterEach(() => {
    resetRedisForTest();
  });

  it("Graceful degradation when initRedis not called", async () => {
    resetRedisForTest();
    await expect(redisSet("k", "v", 60)).resolves.toBeUndefined();
    await expect(redisGet("k")).resolves.toBeNull();
    await expect(redisDel("k")).resolves.toBeUndefined();
    await expect(redisScanEntries("fridge-magnet:*")).resolves.toEqual([]);
  });

  it("setex/get/del/scan via Bun client", async () => {
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
      scan: async (_cursor: string | number, ...args: (string | number)[]) => {
        const glob = String(args[1] ?? "*");
        const keys = [...store.keys()].filter((k) => {
          if (glob === "*") return true;
          if (glob.endsWith("*")) return k.startsWith(glob.slice(0, -1));
          return k === glob;
        });
        return ["0", keys] as [string, string[]];
      },
    } as unknown as RedisClient);

    await redisSet("fridge-magnet:session:a:b", "hello", 60);
    expect(await redisGet("fridge-magnet:session:a:b")).toBe("hello");
    expect(await redisScanEntries("fridge-magnet:session:*")).toEqual([
      { key: "fridge-magnet:session:a:b", value: "hello" },
    ]);
    await redisDel("fridge-magnet:session:a:b");
    expect(await redisGet("fridge-magnet:session:a:b")).toBeNull();
  });
});
