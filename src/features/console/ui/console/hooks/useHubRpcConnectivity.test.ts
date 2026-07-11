import { describe, expect, test } from "bun:test";

import { probeHubHealth } from "./useHubRpcConnectivity.ts";

describe("probeHubHealth", () => {
  test("health ok + authed 返回 true", async () => {
    const fetchFn = async () => Response.json({ status: "ok", authed: true }, { status: 200 });
    expect(await probeHubHealth(fetchFn)).toBe(true);
  });

  test("authed false 返回 false", async () => {
    const fetchFn = async () => Response.json({ status: "ok", authed: false }, { status: 200 });
    expect(await probeHubHealth(fetchFn)).toBe(false);
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
