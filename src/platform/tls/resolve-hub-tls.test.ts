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
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "anima-resolve-tls-"));
    const certPath = join(dir, "cert.pem");
    const keyPath = join(dir, "key.pem");
    const r = spawnSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "1",
        "-nodes",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1,DNS:galaxy,IP:192.168.1.5",
      ],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
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
    rmSync(dir, { recursive: true, force: true });
  });
});
