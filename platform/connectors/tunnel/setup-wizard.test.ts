import { describe, expect, test } from "bun:test";
import { renderCloudflaredConfig } from "./setup-wizard.ts";
import { findZoneForHostname } from "./cloudflare-api.ts";

describe("setup-wizard", () => {
  test("renderCloudflaredConfig ends with catch-all 404", () => {
    const yaml = renderCloudflaredConfig({
      hostname: "anima.example.com",
      hubPort: 2658,
      credentialsFile: "/creds.json",
    });
    expect(yaml).toContain("http_status:404");
  });

  test("renderCloudflaredConfig includes web ingress when configured", () => {
    const yaml = renderCloudflaredConfig({
      hostname: "anima.example.com",
      hubPort: 2658,
      credentialsFile: "/creds.json",
      webHostname: "app.anima.example.com",
      webPort: 2659,
    });
    expect(yaml).toContain("hostname: app.anima.example.com");
    expect(yaml).toContain("http://127.0.0.1:2659");
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
