import { describe, expect, test } from "bun:test";

import { applyHttpAuth } from "./http-dispatch.ts";
import {
  createServiceAuthVerifier,
  parseBearerToken,
  SERVICE_AUTH_UNAUTHORIZED,
} from "./service-auth.ts";

describe("service-auth", () => {
  test("parseBearerToken", () => {
    const req = new Request("http://127.0.0.1:2658/api/status", {
      headers: { Authorization: "Bearer fa_at_abc_def" },
    });
    expect(parseBearerToken(req)).toBe("fa_at_abc_def");
    expect(parseBearerToken(new Request("http://127.0.0.1:2658/api/status"))).toBeNull();
  });

  test("blocks loopback business API without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/status");
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result.blocked?.status).toBe(401);
    expect(await result.blocked?.text()).toBe(SERVICE_AUTH_UNAUTHORIZED);
    expect(result.auth).toBeNull();
  });

  test("blocks loopback /mcp without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/mcp", { method: "POST" });
    const result = await applyHttpAuth(req, "127.0.0.1", verifier);
    expect(result.blocked?.status).toBe(401);
  });

  test("allows GET /api/health without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/health");
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result.blocked).toBeNull();
    expect(result.auth).toBeNull();
  });

  test("allows /api/echo without token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/echo", { method: "POST", body: "x" });
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result.blocked).toBeNull();
  });

  test("allows SAP WebSocket upgrade without REST token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/sap/v1", {
      headers: { Upgrade: "websocket", Connection: "Upgrade" },
    });
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result.blocked).toBeNull();
  });

  test("rejects malformed Bearer token", async () => {
    const verifier = createServiceAuthVerifier();
    const req = new Request("http://127.0.0.1:2658/api/status", {
      headers: { Authorization: "Bearer not-a-valid-token" },
    });
    const result = await verifier.verifyRequest(req, "127.0.0.1");
    expect(result.blocked?.status).toBe(401);
  });
});
