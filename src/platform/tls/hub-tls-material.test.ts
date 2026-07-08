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

describe("ensureHubTlsMaterial", () => {
  test("uses existing files when present", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "anima-tls-test-"));
    const certPath = join(dir, "cert.pem");
    const keyPath = join(dir, "key.pem");
    writeFileSync(certPath, "cert");
    writeFileSync(keyPath, "key");
    const { ensureHubTlsMaterial } = await import("./hub-tls-material.ts");
    const material = ensureHubTlsMaterial({
      certPath,
      keyPath,
      auto: true,
      bindHosts: ["127.0.0.1"],
    });
    expect(material.source).toBe("existing");
    expect(material.certPath).toBe(certPath);
  });
});
