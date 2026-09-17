import { describe, expect, test } from "bun:test";

import { DEFAULT_HABITAT_TLS_PORT } from "./http-ports.ts";
import { httpConfigSchema, httpTlsConfigSchema, resolveHttpTlsMode } from "./http.ts";

describe("httpTlsConfigSchema", () => {
  test("accepts enabled tls with defaults (mode defaults to mkcert)", () => {
    const parsed = httpTlsConfigSchema.safeParse({ enabled: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(resolveHttpTlsMode(parsed.data?.mode)).toBe("mkcert");
    }
  });

  test("accepts mode=manual with cert/key", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "manual",
      cert: "/path/cert.pem",
      key: "/path/key.pem",
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects mode=manual without cert/key", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "manual",
    });
    expect(parsed.success).toBe(false);
  });

  test("accepts mode=acme with email and domains", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "acme",
      acme: {
        email: "you@example.com",
        domains: ["anima.example.com"],
        challenge_port: 80,
        staging: true,
      },
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects mode=acme without acme block", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "acme",
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects mode=mkcert with acme block", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "mkcert",
      acme: {
        email: "you@example.com",
        domains: ["anima.example.com"],
      },
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects acme bare IP domain", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      mode: "acme",
      acme: {
        email: "you@example.com",
        domains: ["203.0.113.10"],
      },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("httpConfigSchema", () => {
  test("accepts http.tls nested config", () => {
    const parsed = httpConfigSchema.safeParse({
      host: "0.0.0.0",
      allowed_hosts: ["feng-vm.lan", "10.200.200.10"],
      tls: { enabled: true, port: 2659 },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data?.tls?.enabled).toBe(true);
      expect(parsed.data?.allowed_hosts).toEqual(["feng-vm.lan", "10.200.200.10"]);
    }
  });

  test("accepts http.port and tls.mode", () => {
    const parsed = httpConfigSchema.safeParse({
      host: "0.0.0.0",
      port: 2658,
      tls: { enabled: true, port: 2659, mode: "mkcert" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data?.port).toBe(2658);
      expect(parsed.data?.tls?.port).toBe(2659);
      expect(parsed.data?.tls?.mode).toBe("mkcert");
    }
  });

  test("DEFAULT_HABITAT_TLS_PORT is 2659", () => {
    expect(DEFAULT_HABITAT_TLS_PORT).toBe(2659);
  });
});
