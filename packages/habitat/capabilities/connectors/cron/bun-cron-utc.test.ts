import { describe, expect, it } from "bun:test";
import { parseBunCronUtc, scheduleBunCronUtc } from "./bun-cron-utc.ts";

describe("bun-cron-utc", () => {
  it("parseBunCronUtc 按 UTC 解释表达式（不受本地 TZ 影响）", () => {
    const from = Date.UTC(2026, 7, 26, 0, 0, 0); // Aug 26 00:00 UTC
    const next = parseBunCronUtc("0 9 * * *", from);
    expect(next).not.toBeNull();
    expect(next?.toISOString()).toBe("2026-08-26T09:00:00.000Z");
  });

  it("scheduleBunCronUtc 可注册并可 stop", () => {
    const handle = scheduleBunCronUtc("0 0 1 1 *", () => {});
    expect(handle.cron).toBe("0 0 1 1 *");
    handle.stop();
  });
});
