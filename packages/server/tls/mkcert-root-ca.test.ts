import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { detectHabitatTlsIssuerKind } from "./mkcert-root-ca.ts";

describe("mkcert-root-ca", () => {
  test("detectHabitatTlsIssuerKind returns missing for absent cert", () => {
    expect(detectHabitatTlsIssuerKind("/nonexistent/cert.pem")).toBe("missing");
  });

  test("detectHabitatTlsIssuerKind returns letsencrypt for LE-like issuer", () => {
    if (!Bun.which("openssl")) return;
    const dir = mkdtempSync(join(tmpdir(), "anima-le-issuer-"));
    try {
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
          "/CN=Fake LE/O=Let's Encrypt",
          "-addext",
          "subjectAltName=DNS:example.com",
        ],
        { encoding: "utf-8" },
      );
      expect(r.status).toBe(0);
      expect(detectHabitatTlsIssuerKind(certPath)).toBe("letsencrypt");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
