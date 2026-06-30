import { describe, expect, test } from "bun:test";
import { buildTunnelSnapshot } from "./tunnel-urls.ts";

describe("tunnel-urls", () => {
  test("buildTunnelSnapshot returns public, API, and web URLs", () => {
    const snap = buildTunnelSnapshot({
      enabled: true,
      hostname: "anima.example.com",
    });
    expect(snap).toEqual({
      enabled: true,
      hostname: "anima.example.com",
      public_url: "https://anima.example.com",
      api_url: "https://anima.example.com/api",
      web_url: "https://anima.example.com/web",
    });
  });

  test("buildTunnelSnapshot returns undefined when disabled", () => {
    expect(buildTunnelSnapshot({ enabled: false, hostname: "x.com" })).toBeUndefined();
  });
});
