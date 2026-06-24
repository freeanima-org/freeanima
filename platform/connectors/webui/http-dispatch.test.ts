import { describe, expect, test } from "bun:test";
import { applyHttpAuth, isHubApiPath } from "./http-dispatch.ts";
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
    const blocked = await applyHttpAuth(req, "127.0.0.1", remoteAuth, null);
    expect(blocked).toBeNull();
  });

  test("applyHttpAuth blocks public host without token", async () => {
    const remoteAuth = createRemoteAuthVerifier({ token: "secret-token-min-16" });
    const req = new Request("https://anima.freetrace.me/api/status");
    const blocked = await applyHttpAuth(req, "127.0.0.1", remoteAuth, null);
    expect(blocked?.status).toBe(401);
  });
});
