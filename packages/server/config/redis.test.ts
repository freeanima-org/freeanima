import { describe, expect, it } from "bun:test";
import { buildRedisUrl } from "./redis.ts";

describe("buildRedisUrl", () => {
  it("defaults to local 6379/0", () => {
    expect(buildRedisUrl()).toBe("redis://127.0.0.1:6379/0");
  });

  it("supports host/port/password/db fields", () => {
    expect(
      buildRedisUrl({
        host: "redis",
        port: 6380,
        password: "s3cret",
        db: 2,
      }),
    ).toBe("redis://:s3cret@redis:6380/2");
  });

  it("url takes precedence over fields", () => {
    expect(
      buildRedisUrl({
        url: "redis://cache:6379/1",
        host: "ignored",
      }),
    ).toBe("redis://cache:6379/1");
  });
});
