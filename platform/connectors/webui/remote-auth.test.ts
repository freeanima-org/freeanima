import { describe, expect, test } from "bun:test";
import {
  createRemoteAuthVerifier,
  isInternalHubHost,
  isLoopbackAddress,
  shouldBypassRemoteAuth,
  tokensEqual,
  verifyRemoteAuthToken,
} from "./remote-auth.ts";

describe("remote-auth", () => {
  test("isLoopbackAddress", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("192.168.1.1")).toBe(false);
  });

  test("isInternalHubHost", () => {
    expect(isInternalHubHost("127.0.0.1")).toBe(true);
    expect(isInternalHubHost("localhost")).toBe(true);
    expect(isInternalHubHost("::1")).toBe(true);
    expect(isInternalHubHost("anima.freetrace.me")).toBe(false);
    expect(isInternalHubHost("192.168.1.10")).toBe(false);
  });

  test("tokensEqual rejects mismatch", () => {
    expect(tokensEqual("abc", "abc")).toBe(true);
    expect(tokensEqual("abc", "abd")).toBe(false);
    expect(tokensEqual("abc", "ab")).toBe(false);
  });

  test("verifyRemoteAuthToken", () => {
    expect(verifyRemoteAuthToken("secret-token-min-16", "secret-token-min-16")).toBe(true);
    expect(verifyRemoteAuthToken("secret-token-min-16", "wrong")).toBe(false);
    expect(verifyRemoteAuthToken("secret-token-min-16", null)).toBe(false);
  });

  test("loopback bypasses REST auth", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://127.0.0.1:2658/api/health");
    expect(await verifier.verifyRequest(req, "127.0.0.1")).toBeNull();
  });

  test("public host via tunnel (loopback peer) requires auth", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/health");
    const res = await verifier.verifyRequest(req, "127.0.0.1");
    expect(res?.status).toBe(401);
  });

  test("public host with CF headers on loopback peer requires auth", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/health", {
      headers: { "cf-ray": "abc123" },
    });
    const res = await verifier.verifyRequest(req, "127.0.0.1");
    expect(res?.status).toBe(401);
  });

  test("loopback host with CF headers still bypasses when peer is loopback", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://127.0.0.1:2658/api/health", {
      headers: { "cf-ray": "abc123" },
    });
    expect(await verifier.verifyRequest(req, "127.0.0.1")).toBeNull();
  });

  test("shouldBypassRemoteAuth", () => {
    const plain = new Request("http://127.0.0.1:2658/api/health");
    const publicHost = new Request("https://anima.freetrace.me/api/health");
    const tunneledLoopbackHost = new Request("http://127.0.0.1:2658/api/health", {
      headers: { "cf-connecting-ip": "203.0.113.1" },
    });
    expect(shouldBypassRemoteAuth(plain, "127.0.0.1")).toBe(true);
    expect(shouldBypassRemoteAuth(publicHost, "127.0.0.1")).toBe(false);
    expect(shouldBypassRemoteAuth(tunneledLoopbackHost, "127.0.0.1")).toBe(true);
    expect(
      shouldBypassRemoteAuth(new Request("http://127.0.0.1:2658/api/status"), "127.0.0.1"),
    ).toBe(true);
    expect(
      shouldBypassRemoteAuth(new Request("http://127.0.0.1:2658/api/status"), "192.168.1.1"),
    ).toBe(false);
  });

  test("loopback host with LAN peer requires auth", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://127.0.0.1:2658/api/status");
    const res = await verifier.verifyRequest(req, "192.168.1.1");
    expect(res?.status).toBe(401);
  });

  test("non-loopback without Bearer returns 401", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://example.com/api/health");
    const res = await verifier.verifyRequest(req, "10.0.0.1");
    expect(res?.status).toBe(401);
    expect(await res?.text()).toBe("Unauthorized");
  });

  test("non-loopback without remote_auth configured returns 401", async () => {
    const verifier = createRemoteAuthVerifier();
    const req = new Request("http://example.com/api/health", {
      headers: { Authorization: "Bearer any-token" },
    });
    const res = await verifier.verifyRequest(req, "10.0.0.1");
    expect(res?.status).toBe(401);
  });

  test("non-loopback with valid Bearer passes", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://example.com/api/health", {
      headers: { Authorization: "Bearer secret-token-min-16" },
    });
    expect(await verifier.verifyRequest(req, "10.0.0.1")).toBeNull();
  });

  test("/api/echo bypasses remote_auth from any origin", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.example.com/api/echo", {
      method: "POST",
      headers: { "cf-ray": "abc", Authorization: "Bearer wrong" },
      body: "test",
    });
    expect(await verifier.verifyRequest(req, "10.0.0.1")).toBeNull();
  });

  test("SAP WebSocket upgrade bypasses REST middleware", async () => {
    const verifier = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://example.com/sap/v1", {
      headers: { Upgrade: "websocket", Connection: "Upgrade" },
    });
    expect(await verifier.verifyRequest(req, "10.0.0.1")).toBeNull();
  });
});
