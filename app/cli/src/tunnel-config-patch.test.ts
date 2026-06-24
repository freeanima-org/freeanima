import { describe, expect, test } from "bun:test";
import { mergeTunnelConfig } from "./tunnel-config-patch.ts";

describe("mergeTunnelConfig", () => {
  test("merges nested access and cloudflare without dropping prior fields", () => {
    const merged = mergeTunnelConfig(
      {
        hostname: "a.example.com",
        enabled: false,
        access: { enabled: true, allowed_emails: ["u@example.com"] },
      },
      {
        cloudflare: { tunnel_id: "tid-1" },
        access: { audience: "aud-1" },
      },
    );
    expect(merged.hostname).toBe("a.example.com");
    expect(merged.cloudflare?.tunnel_id).toBe("tid-1");
    expect(merged.access?.allowed_emails).toEqual(["u@example.com"]);
    expect(merged.access?.audience).toBe("aud-1");
  });
});
