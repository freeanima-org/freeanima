import { describe, expect, test } from "bun:test";

import { probeHubHealth } from "./useHubRestConnectivity.ts";

describe("probeHubHealth", () => {
  test("health ok 返回 true", async () => {
    const fetchFn = async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    expect(await probeHubHealth(fetchFn)).toBe(true);
  });

  test("非 ok 返回 false", async () => {
    const fetchFn = async () => new Response("", { status: 503 });
    expect(await probeHubHealth(fetchFn)).toBe(false);
  });

  test("网络错误返回 false", async () => {
    const fetchFn = async () => {
      throw new Error("network");
    };
    expect(await probeHubHealth(fetchFn)).toBe(false);
  });
});
