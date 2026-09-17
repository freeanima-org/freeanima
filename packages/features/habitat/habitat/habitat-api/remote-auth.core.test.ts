import { describe, expect, test } from "bun:test";
import {
  isHabitatApiCorsPreflight,
  isInternalHabitatHost,
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

  test("isInternalHabitatHost", () => {
    expect(isInternalHabitatHost("127.0.0.1")).toBe(true);
    expect(isInternalHabitatHost("localhost")).toBe(true);
    expect(isInternalHabitatHost("::1")).toBe(true);
    expect(isInternalHabitatHost("anima.freetrace.me")).toBe(false);
    expect(isInternalHabitatHost("192.168.1.10")).toBe(false);
  });

  test("tokensEqual rejects mismatch", () => {
    expect(tokensEqual("abc", "abc")).toBe(true);
    expect(tokensEqual("abc", "abd")).toBe(false);
    expect(tokensEqual("abc", "ab")).toBe(false);
  });

  test("isHabitatApiCorsPreflight", () => {
    const preflight = new Request("https://anima.freetrace.me/rpc/v1/health/probe", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    expect(isHabitatApiCorsPreflight(preflight)).toBe(true);
    const hubRpcPreflight = new Request("https://anima.freetrace.me/rpc/v1", {
      method: "OPTIONS",
      headers: { Origin: "https://localhost" },
    });
    expect(isHabitatApiCorsPreflight(hubRpcPreflight)).toBe(true);
    expect(isHabitatApiCorsPreflight(new Request("http://127.0.0.1:2658/api/status"))).toBe(false);
  });

  test("isSapWebSocketUpgrade", () => {
    const upgrade = new Request("http://example.com/rpc/v1", {
      headers: { Upgrade: "websocket", Connection: "Upgrade" },
    });
    expect(isSapWebSocketUpgrade(upgrade)).toBe(true);
    expect(isSapWebSocketUpgrade(new Request("http://example.com/rpc/v1"))).toBe(false);
  });

  test("isLocalDirectConnection", () => {
    const req = new Request("http://127.0.0.1:2658/mcp", { method: "POST" });
    expect(isLocalDirectConnection(req, "127.0.0.1")).toBe(true);
    expect(isLocalDirectConnection(req, "192.168.1.1")).toBe(false);
  });
});
