import { describe, expect, test } from "bun:test";

import {
  certSanCoversRequired,
  normalizeSanName,
  parseSubjectAltNameField,
  readCertSanNames,
} from "./cert-san.ts";

describe("cert-san", () => {
  test("normalizeSanName collapses IPv6 loopback", () => {
    expect(normalizeSanName("0:0:0:0:0:0:0:1")).toBe("::1");
    expect(normalizeSanName("::1")).toBe("::1");
  });

  test("parseSubjectAltNameField", () => {
    const names = parseSubjectAltNameField("DNS:localhost, IP Address:127.0.0.1, DNS:Galaxy");
    expect(names.has("localhost")).toBe(true);
    expect(names.has("127.0.0.1")).toBe(true);
    expect(names.has("galaxy")).toBe(true);
  });

  test("certSanCoversRequired", () => {
    const cert = new Set(["localhost", "127.0.0.1", "::1"]);
    expect(certSanCoversRequired(cert, ["localhost", "127.0.0.1"])).toBe(true);
    expect(certSanCoversRequired(cert, ["feng-vm.lan"])).toBe(false);
  });

  test("readCertSanNames from PEM", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "anima-cert-san-"));
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
        "subjectAltName=DNS:localhost,DNS:feng-vm.lan,IP:127.0.0.1",
      ],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    const san = readCertSanNames(certPath);
    expect(san?.has("localhost")).toBe(true);
    expect(san?.has("feng-vm.lan")).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});
