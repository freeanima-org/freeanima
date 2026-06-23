import { describe, expect, test } from "bun:test";
import { renderCloudflaredConfig, manualAccessDashboardSteps } from "./setup-wizard.ts";
import { findZoneForHostname } from "./cloudflare-api.ts";

describe("setup-wizard", () => {
  test("renderCloudflaredConfig ends with catch-all 404", () => {
    const yaml = renderCloudflaredConfig("anima.example.com", 2658, "/creds.json");
    expect(yaml).toContain("http_status:404");
  });

  test("manualAccessDashboardSteps includes hostname and email", () => {
    const hostname = "anima.example.com";
    const email = "you@gmail.com";
    const steps = manualAccessDashboardSteps({
      hostname,
      teamName: "myteam",
      email,
    });
    expect(steps[1]).toBe(`2. 域名填写: ${hostname}`);
    expect(steps[2]).toBe(`3. 添加 Allow Policy: Email equals ${email}`);
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
