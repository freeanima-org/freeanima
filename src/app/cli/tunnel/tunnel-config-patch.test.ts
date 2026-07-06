import { describe, expect, test } from "bun:test";
import { mergeTunnelConfig } from "./tunnel-config-patch.ts";

describe("mergeTunnelConfig", () => {
  test("merges nested cloudflare without dropping prior fields", () => {
    const merged = mergeTunnelConfig(
      {
        hostname: "a.example.com",
        enabled: false,
      },
      {
        cloudflare: { tunnel_id: "tid-1" },
      },
    );
    expect(merged.hostname).toBe("a.example.com");
    expect(merged.cloudflare?.tunnel_id).toBe("tid-1");
  });
});
