import { afterEach, describe, expect, it } from "bun:test";
import type { RedisClient } from "bun";
import { pingRedis } from "../../src/health.ts";
import { initRedis, resetRedisForTest, setRedisForTest } from "../../src/client.ts";

describe("pingRedis", () => {
  afterEach(() => {
    resetRedisForTest();
  });

  it("未 initRedis 时返回 not_configured", async () => {
    resetRedisForTest();
    expect(await pingRedis()).toEqual({ status: "not_configured" });
  });

  it("PING 成功时返回 connected", async () => {
    initRedis({ getRedisUrl: () => "redis://127.0.0.1:6379" });
    setRedisForTest({
      ping: async () => "PONG",
    } as unknown as RedisClient);
    const result = await pingRedis();
    expect(result.status).toBe("connected");
    if (result.status === "connected") {
      expect(typeof result.latency_ms).toBe("number");
    }
  });
});
