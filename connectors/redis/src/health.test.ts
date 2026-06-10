import { afterEach, describe, expect, it } from "bun:test";
import type { RedisClient } from "bun";
import { pingRedis } from "./health.ts";
import { initRedis, resetRedisForTest, setRedisForTest } from "./client.ts";

describe("pingRedis", () => {
  afterEach(() => {
    resetRedisForTest();
  });

  it("Returns not_configured when initRedis not called", async () => {
    resetRedisForTest();
    expect(await pingRedis()).toEqual({ status: "not_configured" });
  });

  it("Returns connected on successful PING", async () => {
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
