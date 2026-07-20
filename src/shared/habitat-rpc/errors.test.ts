import { describe, expect, test } from "bun:test";

import {
  isHabitatRpcTimeoutError,
  isHabitatRpcTransportError,
  HabitatRpcTimeoutError,
} from "./errors.ts";

describe("habitat-rpc errors", () => {
  test("isHabitatRpcTimeoutError 识别 HabitatRpcTimeoutError", () => {
    expect(isHabitatRpcTimeoutError(new HabitatRpcTimeoutError("x"))).toBe(true);
    expect(isHabitatRpcTimeoutError(new Error("hub_rpc_timeout: x"))).toBe(true);
    expect(isHabitatRpcTimeoutError(new Error("other"))).toBe(false);
  });

  test("isHabitatRpcTransportError 识别 WebSocket 与超时", () => {
    expect(isHabitatRpcTransportError(new HabitatRpcTimeoutError("x"))).toBe(true);
    expect(isHabitatRpcTransportError(new Error("Habitat RPC WebSocket closed"))).toBe(true);
    expect(isHabitatRpcTransportError(new Error("request timed out"))).toBe(true);
    expect(isHabitatRpcTransportError(new Error("validation failed"))).toBe(false);
  });
});
