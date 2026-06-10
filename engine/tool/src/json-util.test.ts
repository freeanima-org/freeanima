import { describe, expect, it } from "bun:test";
import {
  parseToolArgs,
  parseToolResult,
  toolArgsSchema,
  toolError,
  toolErrorSchema,
  toolResult,
} from "./index.ts";

describe("json-util", () => {
  it("toolErrorSchema validates error field", () => {
    expect(toolErrorSchema.safeParse({ error: "bad" }).success).toBe(true);
    expect(toolErrorSchema.safeParse({ error: "" }).success).toBe(false);
  });

  it("toolArgsSchema requires JSON object", () => {
    expect(toolArgsSchema.safeParse({ a: 1 }).success).toBe(true);
    expect(toolArgsSchema.safeParse([]).success).toBe(false);
  });

  it("toolResult / toolError return JSON string", () => {
    expect(toolResult({ ok: true })).toBe('{"ok":true}');
    expect(toolError("fail")).toBe('{"error":"fail"}');
  });

  it("parseToolArgs parses object args", () => {
    expect(parseToolArgs('{"x":1}')).toEqual({ ok: true, data: { x: 1 } });
    expect(parseToolArgs(null)).toEqual({ ok: true, data: {} });
  });

  it("parseToolResult recognizes error convention", () => {
    expect(parseToolResult('{"error":"oops"}')).toEqual({ ok: false, error: "oops" });
    expect(parseToolResult('{"ok":true}')).toEqual({ ok: true, data: { ok: true } });
  });
});
