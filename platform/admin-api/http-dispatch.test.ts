import { describe, expect, test } from "bun:test";
import { applyHttpAuth, handleHubCorsPreflight, isHubApiPath } from "./http-dispatch.ts";
import { createRemoteAuthVerifier } from "./remote-auth.ts";

describe("http-dispatch", () => {
  test("isHubApiPath", () => {
    expect(isHubApiPath("/")).toBe(true);
    expect(isHubApiPath("/api")).toBe(true);
    expect(isHubApiPath("/api/")).toBe(true);
    expect(isHubApiPath("/api/health")).toBe(true);
    expect(isHubApiPath("/sap/v1")).toBe(false);
  });

  test("applyHttpAuth allows loopback GET /api/health on internal host", async () => {
    const remoteAuth = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("http://127.0.0.1:2658/api/health");
    const blocked = await applyHttpAuth(req, "127.0.0.1", remoteAuth);
    expect(blocked).toBeNull();
  });

  test("applyHttpAuth allows GET /api/health on public host without token", async () => {
    const remoteAuth = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/health");
    const blocked = await applyHttpAuth(req, "127.0.0.1", remoteAuth);
    expect(blocked).toBeNull();
  });

  test("applyHttpAuth blocks public host without token for status", async () => {
    const remoteAuth = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/status");
    const blocked = await applyHttpAuth(req, "127.0.0.1", remoteAuth);
    expect(blocked?.status).toBe(401);
  });

  test("handleHubCorsPreflight returns 204 for Capacitor origin", () => {
    const req = new Request("https://hub.example.com/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    const res = handleHubCorsPreflight(req);
    expect(res?.status).toBe(204);
    expect(res?.headers.get("Access-Control-Allow-Origin")).toBe("https://localhost");
  });

  test("applyHttpAuth allows OPTIONS preflight without token", async () => {
    const remoteAuth = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    const blocked = await applyHttpAuth(req, "10.0.0.1", remoteAuth);
    expect(blocked).toBeNull();
  });
});
