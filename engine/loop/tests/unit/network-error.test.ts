import {
  isTransientNetworkError,
  isEngineStreamError,
  networkErrorUserHint,
} from "@freeanima/engine-loop";
import { describe, it, expect } from "bun:test";

describe("network-error", () => {
  it("detects ConnectTimeoutError", () => {
    const err = new Error("Connect Timeout Error");
    err.name = "ConnectTimeoutError";
    expect(isTransientNetworkError(err)).toBe(true);
  });

  it("detects fetch failed", () => {
    expect(isTransientNetworkError(new TypeError("fetch failed"))).toBe(true);
  });

  it("detects handshake timeout", () => {
    expect(isTransientNetworkError(new Error("Opening handshake has timed out"))).toBe(true);
  });

  it("detects cause chain", () => {
    const inner = new Error("connect timeout");
    inner.name = "ConnectTimeoutError";
    const outer = new Error("request failed", { cause: inner });
    expect(isTransientNetworkError(outer)).toBe(true);
  });

  it("rejects generic application errors", () => {
    expect(isTransientNetworkError(new Error("Session not found"))).toBe(false);
  });

  it("classifies engine stream errors", () => {
    expect(isEngineStreamError(new Error("LLM 调用失败: rate limit"))).toBe(true);
    expect(isEngineStreamError(new Error("engine error"))).toBe(true);
    expect(isEngineStreamError(new Error("Connect Timeout Error"))).toBe(false);
  });

  it("returns appropriate user hints", () => {
    const net = new Error("fetch failed");
    expect(networkErrorUserHint(net)).toContain("网络");
    const engine = new Error("LLM 调用失败: x");
    expect(networkErrorUserHint(engine)).toContain("引擎");
  });
});
