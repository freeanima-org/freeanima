import { describe, expect, test } from "bun:test";
import {
  isAuthExemptPath,
  isHealthProbePath,
  isHubApiCorsPreflight,
  isInternalHubHost,
  isLocalDirectConnection,
  isLoopbackAddress,
  isSapWebSocketUpgrade,
  tokensEqual,
} from "./remote-auth.ts";

describe("remote-auth helpers", () => {
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

  test("isAuthExemptPath", () => {
    expect(isAuthExemptPath(new Request("http://127.0.0.1:2658/api/echo"))).toBe(true);
    expect(isAuthExemptPath(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
  });

  test("isHealthProbePath", () => {
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/health"))).toBe(true);
    expect(isHealthProbePath(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
  });

  test("isHubApiCorsPreflight", () => {
    const preflight = new Request("https://anima.freetrace.me/api/health", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    expect(isHubApiCorsPreflight(preflight)).toBe(true);
    expect(isHubApiCorsPreflight(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
  });

  test("isSapWebSocketUpgrade", () => {
    const upgrade = new Request("http://example.com/hub/rpc/v1", {
      headers: { Upgrade: "websocket", Connection: "Upgrade" },
    });
    expect(isSapWebSocketUpgrade(upgrade)).toBe(true);
    expect(isSapWebSocketUpgrade(new Request("http://example.com/hub/rpc/v1"))).toBe(false);
  });

  test("isLocalDirectConnection", () => {
    const req = new Request("http://127.0.0.1:2658/mcp", { method: "POST" });
    expect(isLocalDirectConnection(req, "127.0.0.1")).toBe(true);
    expect(isLocalDirectConnection(req, "192.168.1.1")).toBe(false);
  });
});
