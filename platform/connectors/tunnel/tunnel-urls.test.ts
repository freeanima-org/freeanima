import { describe, expect, test } from "bun:test";
import { buildTunnelSnapshot } from "./tunnel-urls.ts";

describe("tunnel-urls", () => {
  test("buildTunnelSnapshot returns public and chamber URLs", () => {
    const snap = buildTunnelSnapshot({
      enabled: true,
      hostname: "anima.example.com",
    });
    expect(snap).toEqual({
      enabled: true,
      hostname: "anima.example.com",
      public_url: "https://anima.example.com",
      webui_url: "https://anima.example.com/webui",
      chamber_url: "https://anima.example.com/webui/chamber/dashboard",
    });
  });

  test("buildTunnelSnapshot returns undefined when disabled", () => {
    expect(buildTunnelSnapshot({ enabled: false, hostname: "x.com" })).toBeUndefined();
  });
});
