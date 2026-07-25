import { describe, expect, test } from "bun:test";

import { DEFAULT_HABITAT_TLS_PORT } from "./http-ports.ts";
import { httpConfigSchema, httpTlsConfigSchema } from "./http.ts";

describe("httpTlsConfigSchema", () => {
  test("accepts enabled tls with defaults", () => {
    const parsed = httpTlsConfigSchema.safeParse({ enabled: true });
    expect(parsed.success).toBe(true);
  });

  test("accepts manual cert paths", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      cert: "/path/cert.pem",
      key: "/path/key.pem",
      auto: false,
    });
    expect(parsed.success).toBe(true);
  });

  test("accepts acme with email and domains", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      acme: {
        email: "you@example.com",
        domains: ["anima.example.com"],
        challenge_port: 80,
        staging: true,
      },
    });
    expect(parsed.success).toBe(true);
  });

  test("rejects acme missing email", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
      acme: { domains: ["anima.example.com"] },
    });
    expect(parsed.success).toBe(false);
  });

  test("rejects acme bare IP domain", () => {
    const parsed = httpTlsConfigSchema.safeParse({
      enabled: true,
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

  test("DEFAULT_HABITAT_TLS_PORT is 2659", () => {
    expect(DEFAULT_HABITAT_TLS_PORT).toBe(2659);
  });
});
