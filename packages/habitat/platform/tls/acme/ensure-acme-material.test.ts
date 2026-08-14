import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

import { ensureAcmeMaterialWithMeta, existingAcmeCertReusable } from "./ensure-acme-material.ts";

function opensslCert(
  dir: string,
  days: number,
  sanDns: string[],
): { certPath: string; keyPath: string } {
  const certPath = join(dir, "cert.pem");
  const keyPath = join(dir, "key.pem");
  const san = sanDns.map((d) => `DNS:${d}`).join(",");
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
      String(days),
      "-nodes",
      "-subj",
      `/CN=${sanDns[0]}`,
      "-addext",
      `subjectAltName=${san}`,
    ],
    { encoding: "utf-8" },
  );
  expect(r.status).toBe(0);
  return { certPath, keyPath };
}

const describeOpenSsl = Bun.which("openssl") ? describe : describe.skip;

describeOpenSsl("ensure-acme-material", () => {
  test("existingAcmeCertReusable true when SAN matches and long-lived", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-reuse-"));
    try {
      const { certPath, keyPath } = opensslCert(dir, 90, ["anima.example.com"]);
      expect(existingAcmeCertReusable(certPath, keyPath, ["anima.example.com"], new Date())).toBe(
        true,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("existingAcmeCertReusable false when domain mismatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-san-"));
    try {
      const { certPath, keyPath } = opensslCert(dir, 90, ["other.example.com"]);
      expect(existingAcmeCertReusable(certPath, keyPath, ["anima.example.com"], new Date())).toBe(
        false,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("existingAcmeCertReusable false when near expiry", () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-exp-"));
    try {
      const { certPath, keyPath } = opensslCert(dir, 10, ["anima.example.com"]);
      expect(existingAcmeCertReusable(certPath, keyPath, ["anima.example.com"], new Date())).toBe(
        false,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ensureAcmeMaterialWithMeta reuses without calling issueFn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-ensure-"));
    try {
      const { certPath, keyPath } = opensslCert(dir, 90, ["anima.example.com"]);
      let issued = 0;
      const result = await ensureAcmeMaterialWithMeta({
        certPath,
        keyPath,
        email: "you@example.com",
        domains: ["anima.example.com"],
        issueFn: async () => {
          issued += 1;
          return { certPem: "bad", keyPem: "bad" };
        },
      });
      expect(result.renewed).toBe(false);
      expect(result.material.source).toBe("acme");
      expect(issued).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ensureAcmeMaterialWithMeta issues when missing", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-issue-"));
    try {
      const certPath = join(dir, "cert.pem");
      const keyPath = join(dir, "key.pem");
      const fixture = opensslCert(dir, 90, ["anima.example.com"]);
      // use fixture PEM as mock issuance into fresh paths
      const certPem = await Bun.file(fixture.certPath).text();
      const keyPem = await Bun.file(fixture.keyPath).text();
      rmSync(fixture.certPath);
      rmSync(fixture.keyPath);

      let issued = 0;
      const result = await ensureAcmeMaterialWithMeta({
        certPath,
        keyPath,
        email: "you@example.com",
        domains: ["anima.example.com"],
        issueFn: async () => {
          issued += 1;
          return { certPem, keyPem };
        },
      });
      expect(result.renewed).toBe(true);
      expect(issued).toBe(1);
      expect(await Bun.file(certPath).exists()).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("ensureAcmeMaterialWithMeta reissues on domain mismatch", async () => {
    const dir = mkdtempSync(join(tmpdir(), "anima-acme-reissue-"));
    try {
      const old = opensslCert(dir, 90, ["old.example.com"]);
      const freshDir = mkdtempSync(join(tmpdir(), "anima-acme-fresh-"));
      const fresh = opensslCert(freshDir, 90, ["new.example.com"]);
      const certPem = await Bun.file(fresh.certPath).text();
      const keyPem = await Bun.file(fresh.keyPath).text();
      rmSync(freshDir, { recursive: true, force: true });

      let issued = 0;
      const result = await ensureAcmeMaterialWithMeta({
        certPath: old.certPath,
        keyPath: old.keyPath,
        email: "you@example.com",
        domains: ["new.example.com"],
        issueFn: async () => {
          issued += 1;
          return { certPem, keyPem };
        },
      });
      expect(result.renewed).toBe(true);
      expect(issued).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
