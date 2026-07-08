import { describe, expect, test } from "bun:test";

import { DEFAULT_HUB_TLS_PORT } from "@freeanima/core/config";

describe("resolveHubTlsListenConfig", () => {
  test("returns null when tls disabled", async () => {
    const { resolveHubTlsListenConfig } = await import("./resolve-hub-tls.ts");
    const result = await resolveHubTlsListenConfig({ tls: { enabled: false } }, ["127.0.0.1"]);
    expect(result).toBeNull();
  });

  test("returns null when tls section missing", async () => {
    const { resolveHubTlsListenConfig } = await import("./resolve-hub-tls.ts");
    const result = await resolveHubTlsListenConfig({}, ["127.0.0.1"]);
    expect(result).toBeNull();
  });

  test("uses default port when enabled with existing material", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "anima-resolve-tls-"));
    const certPath = join(dir, "cert.pem");
    const keyPath = join(dir, "key.pem");
    writeFileSync(certPath, "cert");
    writeFileSync(keyPath, "key");
    const { resolveHubTlsListenConfig } = await import("./resolve-hub-tls.ts");
    const result = await resolveHubTlsListenConfig(
      {
        tls: {
          enabled: true,
          cert: certPath,
          key: keyPath,
          auto: false,
        },
      },
      ["127.0.0.1", "192.168.1.5"],
    );
    expect(result?.port).toBe(DEFAULT_HUB_TLS_PORT);
    expect(result?.material.source).toBe("existing");
    expect(result?.material.certPath).toBe(certPath);
  });
});
