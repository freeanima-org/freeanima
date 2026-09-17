import { describe, expect, it } from "bun:test";
import { federationConfigSchema } from "./federation.ts";

describe("federationConfigSchema", () => {
  it("rejects hub with federation.hub configured", () => {
    const parsed = federationConfigSchema.safeParse({
      enabled: true,
      role: "hub",
      hub: {
        origin: "https://hub.example.com",
        habitat_instance_id: "fa_inst_hub",
        public_key: "pk",
      },
    });
    expect(parsed.success).toBe(false);
  });

  it("requires hub block for satellite role", () => {
    const parsed = federationConfigSchema.safeParse({
      enabled: true,
      role: "satellite",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts valid satellite config", () => {
    const parsed = federationConfigSchema.safeParse({
      enabled: true,
      role: "satellite",
      hub: {
        origin: "https://hub.example.com",
        habitat_instance_id: "fa_inst_hub",
        public_key: "pk",
      },
    });
    expect(parsed.success).toBe(true);
  });
});
