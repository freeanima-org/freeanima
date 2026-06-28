import { describe, expect, test } from "bun:test";
import { renderCloudflaredConfig } from "@freeanima/platform/connectors/tunnel";

describe("tunnel-config-gen", () => {
  test("renderCloudflaredConfig includes hostname and hub port", () => {
    const yaml = renderCloudflaredConfig({
      hostname: "anima.example.com",
      hubPort: 2658,
      credentialsFile: "/tmp/creds.json",
    });
    expect(yaml).toContain("hostname: anima.example.com");
    expect(yaml).toContain("http://127.0.0.1:2658");
    expect(yaml).toContain("/tmp/creds.json");
  });
});
