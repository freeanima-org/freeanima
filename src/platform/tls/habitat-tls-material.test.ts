import { describe, expect, test } from "bun:test";

import {
  buildOpenSslSubjectAltName,
  collectTlsSanNames,
  expandConfigPath,
  isIpv4Host,
} from "./tls-paths.ts";

describe("tls-paths", () => {
  test("expandConfigPath expands tilde", () => {
    const expanded = expandConfigPath("~/certs/cert.pem");
    expect(expanded.endsWith("/certs/cert.pem")).toBe(true);
  });

  test("collectTlsSanNames includes loopback and bind hosts", () => {
    const names = collectTlsSanNames(["127.0.0.1", "192.168.1.10", "0.0.0.0"]);
    expect(names).toContain("localhost");
    expect(names).toContain("127.0.0.1");
    expect(names).toContain("::1");
    expect(names).toContain("192.168.1.10");
    expect(names).not.toContain("0.0.0.0");
  });

  test("collectTlsSanNames merges allowed_hosts", () => {
    const names = collectTlsSanNames(["0.0.0.0"], ["feng-vm.lan", "10.200.200.10"]);
    expect(names).toContain("feng-vm.lan");
    expect(names).toContain("10.200.200.10");
    expect(names).not.toContain("0.0.0.0");
  });

  test("buildOpenSslSubjectAltName maps IP and DNS", () => {
    expect(buildOpenSslSubjectAltName(["localhost", "192.168.1.2"])).toBe(
      "DNS:localhost,IP:192.168.1.2",
    );
  });

  test("isIpv4Host", () => {
    expect(isIpv4Host("10.0.0.1")).toBe(true);
    expect(isIpv4Host("galaxy")).toBe(false);
  });
});

describe("ensureHabitatTlsMaterial", () => {
  test("uses existing files when present and SAN covers bind hosts", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "anima-tls-test-"));
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
        "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1",
      ],
      { encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    const { ensureHabitatTlsMaterial } = await import("./habitat-tls-material.ts");
    const material = ensureHabitatTlsMaterial({
      certPath,
      keyPath,
      auto: true,
      bindHosts: ["127.0.0.1"],
    });
    expect(material.source).toBe("existing");
    expect(material.certPath).toBe(certPath);
    rmSync(dir, { recursive: true, force: true });
  });
});
