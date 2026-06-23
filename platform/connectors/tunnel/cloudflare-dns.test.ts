import { describe, expect, test } from "bun:test";
import { dnsRecordName, manualDnsDashboardSteps, tunnelCnameTarget } from "./cloudflare-api.ts";

describe("cloudflare-dns", () => {
  test("dnsRecordName strips zone suffix", () => {
    expect(dnsRecordName("anima.example.com", "example.com")).toBe("anima");
    expect(dnsRecordName("app.staging.example.com", "example.com")).toBe("app.staging");
  });

  test("tunnelCnameTarget", () => {
    const tunnelId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    expect(tunnelCnameTarget(tunnelId)).toBe(`${tunnelId}.cfargotunnel.com`);
  });

  test("manualDnsDashboardSteps includes target and zone", () => {
    const tunnelId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
    const steps = manualDnsDashboardSteps("anima.example.com", tunnelId, "example.com");
    expect(steps.join("\n")).toContain("cfargotunnel.com");
    expect(steps.join("\n")).toContain("example.com");
    expect(steps.join("\n")).toContain("DNS · Edit");
  });
});
