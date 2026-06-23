import { describe, expect, test } from "bun:test";
import { renderCloudflaredConfig, manualAccessDashboardSteps } from "./setup-wizard.ts";
import { findZoneForHostname } from "./cloudflare-api.ts";

describe("setup-wizard", () => {
  test("renderCloudflaredConfig ends with catch-all 404", () => {
    const yaml = renderCloudflaredConfig("anima.example.com", 2658, "/creds.json");
    expect(yaml).toContain("http_status:404");
  });

  test("manualAccessDashboardSteps includes hostname and email", () => {
    const steps = manualAccessDashboardSteps({
      hostname: "anima.example.com",
      teamName: "myteam",
      email: "you@gmail.com",
    });
    expect(steps.some((s) => s.includes("anima.example.com"))).toBe(true);
    expect(steps.some((s) => s.includes("you@gmail.com"))).toBe(true);
  });
});

describe("findZoneForHostname", () => {
  test("matches longest zone suffix", () => {
    const zone = findZoneForHostname(
      [
        { id: "1", name: "example.com" },
        { id: "2", name: "sub.example.com" },
      ],
      "anima.example.com",
    );
    expect(zone?.id).toBe("1");
  });
});
