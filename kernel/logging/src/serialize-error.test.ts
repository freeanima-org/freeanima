import { describe, expect, it } from "bun:test";
import { normalizeAttributes, serializeError } from "./serialize-error.ts";

describe("serializeError", () => {
  it("Error 实例序列化为 name/message/stack", () => {
    const err = new Error("boom");
    err.name = "CustomError";
    expect(serializeError(err)).toEqual({
      name: "CustomError",
      message: "boom",
      stack: err.stack,
    });
  });

  it("非 Error 原样返回", () => {
    expect(serializeError("plain")).toBe("plain");
    expect(serializeError({ code: 503 })).toEqual({ code: 503 });
    expect(serializeError(null)).toBe(null);
  });
});

describe("normalizeAttributes", () => {
  it("仅 err 键走 serializeError", () => {
    const err = new Error("fail");
    const out = normalizeAttributes({
      err,
      status: 503,
      component: "http",
    });
    expect(out.status).toBe(503);
    expect(out.component).toBe("http");
    expect(out.err).toEqual({
      name: "Error",
      message: "fail",
      stack: err.stack,
    });
  });

  it("无 err 时其它键不变", () => {
    expect(normalizeAttributes({ sessionId: "x" })).toEqual({ sessionId: "x" });
  });

  it("空对象", () => {
    expect(normalizeAttributes({})).toEqual({});
  });
});
