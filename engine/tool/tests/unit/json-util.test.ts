import { describe, expect, it } from "bun:test";
import {
  parseToolArgs,
  parseToolResult,
  toolArgsSchema,
  toolError,
  toolErrorSchema,
  toolResult,
} from "../../src/index.ts";

describe("json-util", () => {
  it("toolErrorSchema 校验 error 字段", () => {
    expect(toolErrorSchema.safeParse({ error: "bad" }).success).toBe(true);
    expect(toolErrorSchema.safeParse({ error: "" }).success).toBe(false);
  });

  it("toolArgsSchema 要求 JSON 对象", () => {
    expect(toolArgsSchema.safeParse({ a: 1 }).success).toBe(true);
    expect(toolArgsSchema.safeParse([]).success).toBe(false);
  });

  it("toolResult / toolError 返回 JSON 字符串", () => {
    expect(toolResult({ ok: true })).toBe('{"ok":true}');
    expect(toolError("fail")).toBe('{"error":"fail"}');
  });

  it("parseToolArgs 解析对象参数", () => {
    expect(parseToolArgs('{"x":1}')).toEqual({ ok: true, data: { x: 1 } });
    expect(parseToolArgs(null)).toEqual({ ok: true, data: {} });
  });

  it("parseToolResult 识别 error 约定", () => {
    expect(parseToolResult('{"error":"oops"}')).toEqual({ ok: false, error: "oops" });
    expect(parseToolResult('{"ok":true}')).toEqual({ ok: true, data: { ok: true } });
  });
});
