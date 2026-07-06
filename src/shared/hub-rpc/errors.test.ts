import { describe, expect, test } from "bun:test";

import { isHubRpcTimeoutError, isHubRpcTransportError, HubRpcTimeoutError } from "./errors.ts";

describe("hub-rpc errors", () => {
  test("isHubRpcTimeoutError 识别 HubRpcTimeoutError", () => {
    expect(isHubRpcTimeoutError(new HubRpcTimeoutError("x"))).toBe(true);
    expect(isHubRpcTimeoutError(new Error("hub_rpc_timeout: x"))).toBe(true);
    expect(isHubRpcTimeoutError(new Error("other"))).toBe(false);
  });

  test("isHubRpcTransportError 识别 WebSocket 与超时", () => {
    expect(isHubRpcTransportError(new HubRpcTimeoutError("x"))).toBe(true);
    expect(isHubRpcTransportError(new Error("Hub RPC WebSocket closed"))).toBe(true);
    expect(isHubRpcTransportError(new Error("request timed out"))).toBe(true);
    expect(isHubRpcTransportError(new Error("validation failed"))).toBe(false);
  });
});
