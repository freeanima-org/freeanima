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

  it("Error.cause 递归序列化", () => {
    const root = new Error("Failed query");
    root.name = "DrizzleQueryError";
    const pg = new Error("connection terminated");
    pg.name = "PostgresError";
    root.cause = pg;

    expect(serializeError(root)).toEqual({
      name: "DrizzleQueryError",
      message: "Failed query",
      stack: root.stack,
      cause: {
        name: "PostgresError",
        message: "connection terminated",
        stack: pg.stack,
      },
    });
  });

  it("cause 为字符串时原样保留", () => {
    const err = new Error("outer");
    err.cause = "inner reason";
    expect(serializeError(err)).toEqual({
      name: "Error",
      message: "outer",
      stack: err.stack,
      cause: "inner reason",
    });
  });

  it("过深 cause 链截断", () => {
    const root = new Error("depth-0");
    let node: Error = root;
    for (let i = 1; i <= 7; i++) {
      const next = new Error(`depth-${i}`);
      node.cause = next;
      node = next;
    }
    const serialized = serializeError(root) as { cause?: { cause?: unknown } };
    let depth = 0;
    let cursor: unknown = serialized;
    while (cursor && typeof cursor === "object" && "cause" in cursor) {
      depth++;
      cursor = (cursor as { cause?: unknown }).cause;
    }
    expect(depth).toBe(5);
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

  it("err 含 cause 时一并序列化", () => {
    const err = new Error("outer");
    err.cause = new Error("inner");
    const out = normalizeAttributes({ err, component: "db" });
    expect(out.component).toBe("db");
    expect(out.err).toEqual({
      name: "Error",
      message: "outer",
      stack: err.stack,
      cause: {
        name: "Error",
        message: "inner",
        stack: (err.cause as Error).stack,
      },
    });
  });
});
