import { describe, expect, it } from "bun:test";
import { buildRedisUrl } from "../../src/redis.ts";

describe("buildRedisUrl", () => {
  it("默认本地 6379/0", () => {
    expect(buildRedisUrl()).toBe("redis://127.0.0.1:6379/0");
  });

  it("支持分项 host/port/password/db", () => {
    expect(
      buildRedisUrl({
        host: "redis",
        port: 6380,
        password: "s3cret",
        db: 2,
      }),
    ).toBe("redis://:s3cret@redis:6380/2");
  });

  it("url 优先于分项", () => {
    expect(
      buildRedisUrl({
        url: "redis://cache:6379/1",
        host: "ignored",
      }),
    ).toBe("redis://cache:6379/1");
  });
});
