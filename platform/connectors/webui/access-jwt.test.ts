import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  accessConfigFromTunnel,
  createAccessJwtVerifier,
  parseAccessCertsBody,
} from "./access-jwt.ts";

const ACCESS_CERTS_FIXTURE = JSON.parse(
  readFileSync(join(import.meta.dir, "fixtures/access-certs.json"), "utf-8"),
);

describe("access-jwt", () => {
  test("parseAccessCertsBody loads certs from Cloudflare fixture", async () => {
    const certs = await parseAccessCertsBody(ACCESS_CERTS_FIXTURE);
    expect(certs).toHaveLength(ACCESS_CERTS_FIXTURE.public_certs.length);
    expect(certs.map((c) => c.kid).sort()).toEqual(
      ACCESS_CERTS_FIXTURE.public_certs.map((p: { kid: string }) => p.kid).sort(),
    );
  });

  test("parseAccessCertsBody falls back to all JWK keys without public_certs", async () => {
    const certs = await parseAccessCertsBody({
      keys: [
        {
          kid: "73b851040317ff4912e2f5f4c3f60afb12a284155987bf8093a2bb83d2c127a5",
          kty: "RSA",
          alg: "RS256",
          use: "sig",
          e: "AQAB",
          n: "tqFfU3GRazIUAB7PWIt2-3RS0XAT3pXOp8Cx54eWgIpTjgJuUssfR2G5V-6b3iePhTym5b-Wg-wUpJCCR8L15LpsoaxJjDO2-kVigt7LbpPRkF4EaXOk3M6M_DI1nAj8_UgYANU3ZHaCvAbiDF17u2USIBqV0rp7GjM0cbvAOIiP6SCJ7RC5LFKW2Lg7N22RWFLnXx_vsGmBCOpZLvtV-JCipHDgwFXnt-y3HUPr2R6EdfPrmBvikh8mCUJcT-vGfDxxEI84pKIBNtxRALMeHAEh3RMuMYmE9tg_JnBoiGsDzGSj8QyYxOXftWc4gwzg1XNZslvLkQ0797pU9oWiyw",
        },
      ],
    });
    expect(certs).toHaveLength(1);
    expect(certs[0]?.kid).toBe("73b851040317ff4912e2f5f4c3f60afb12a284155987bf8093a2bb83d2c127a5");
  });

  test("accessConfigFromTunnel returns null when incomplete", () => {
    expect(accessConfigFromTunnel("team", { enabled: true })).toBeNull();
    expect(
      accessConfigFromTunnel(undefined, {
        enabled: true,
        audience: "aud",
        allowed_emails: ["a@b.com"],
      }),
    ).toBeNull();
  });

  test("accessConfigFromTunnel builds config", () => {
    const cfg = accessConfigFromTunnel("myteam", {
      enabled: true,
      audience: "aud-tag",
      allowed_emails: ["you@gmail.com"],
    });
    expect(cfg).toEqual({
      teamName: "myteam",
      audience: "aud-tag",
      allowedEmails: ["you@gmail.com"],
      enabled: true,
    });
  });

  test("loopback without CF headers bypasses auth", async () => {
    const verifier = createAccessJwtVerifier({
      teamName: "myteam",
      audience: "aud",
      allowedEmails: ["you@gmail.com"],
      enabled: true,
    });
    const req = new Request("http://127.0.0.1:2658/api/health");
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result).toBeNull();
  });

  test("CF connecting IP without JWT returns 401", async () => {
    const verifier = createAccessJwtVerifier({
      teamName: "myteam",
      audience: "aud",
      allowedEmails: ["you@gmail.com"],
      enabled: true,
    });
    const req = new Request("http://127.0.0.1:2658/api/health", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result?.status).toBe(401);
  });

  test("disabled verifier always allows", async () => {
    const verifier = createAccessJwtVerifier({
      teamName: "myteam",
      audience: "aud",
      allowedEmails: ["you@gmail.com"],
      enabled: false,
    });
    const req = new Request("http://example.com/api/health", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    const result = await verifier.verifyRequest(req, "10.0.0.1");
    expect(result).toBeNull();
  });
});
