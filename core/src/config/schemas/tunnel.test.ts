import { describe, expect, test } from "bun:test";
import { tunnelConfigSchema } from "./tunnel.ts";

describe("tunnelConfigSchema", () => {
  test("accepts minimal tunnel config", () => {
    const parsed = tunnelConfigSchema.safeParse({
      enabled: true,
      hostname: "anima.example.com",
      team_name: "myteam",
      access: {
        enabled: true,
        allowed_emails: ["you@gmail.com"],
        audience: "abc123",
      },
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects invalid email in allowed_emails", () => {
    const parsed = tunnelConfigSchema.safeParse({
      access: { allowed_emails: ["not-an-email"] },
    });
    expect(parsed.success).toBe(false);
  });
});
