import { describe, expect, test } from "bun:test";
import { tunnelConfigSchema } from "./tunnel.ts";

describe("tunnelConfigSchema", () => {
  test("accepts minimal tunnel config", () => {
    const parsed = tunnelConfigSchema.safeParse({
      enabled: true,
      hostname: "anima.example.com",
      cloudflare: { tunnel_id: "tid-1" },
    });
    expect(parsed.success).toBe(true);
  });
});
