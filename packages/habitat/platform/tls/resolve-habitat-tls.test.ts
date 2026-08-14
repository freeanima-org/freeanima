import { describe, expect, test } from "bun:test";

import { DEFAULT_HABITAT_TLS_PORT } from "@freeanima/habitat/core/config";

describe("resolveHabitatTlsListenConfig", () => {
  test("returns null when tls disabled", async () => {
    const { resolveHabitatTlsListenConfig } = await import("./resolve-habitat-tls.ts");
    const result = await resolveHabitatTlsListenConfig({ tls: { enabled: false } }, ["127.0.0.1"]);
    expect(result).toBeNull();
  });

  test("returns null when tls section missing", async () => {
    const { resolveHabitatTlsListenConfig } = await import("./resolve-habitat-tls.ts");
    const result = await resolveHabitatTlsListenConfig({}, ["127.0.0.1"]);
    expect(result).toBeNull();
  });

  test("uses default port when enabled with existing material", async () => {
    if (!Bun.which("openssl")) return;
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
    const { resolveHabitatTlsListenConfig } = await import("./resolve-habitat-tls.ts");
    const result = await resolveHabitatTlsListenConfig(
      {
        tls: {
          enabled: true,
          mode: "manual",
          cert: certPath,
          key: keyPath,
        },
      },
      ["127.0.0.1", "192.168.1.5"],
    );
    expect(result?.port).toBe(DEFAULT_HABITAT_TLS_PORT);
    expect(result?.material.source).toBe("existing");
    expect(result?.material.certPath).toBe(certPath);
    rmSync(dir, { recursive: true, force: true });
  });
});
