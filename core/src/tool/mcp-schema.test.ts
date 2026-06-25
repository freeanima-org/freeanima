import { describe, it, expect } from "bun:test";
import {
  extractMcpResult,
  handlerResultToMcpContent,
  mcpToolParameters,
  normalizeJsonSchema,
  toolParametersToMcpInputSchema,
} from "./mcp-schema.ts";

describe("normalizeJsonSchema", () => {
  it("defaults empty input to object schema", () => {
    expect(normalizeJsonSchema()).toEqual({ type: "object", properties: {} });
    expect(normalizeJsonSchema(undefined)).toEqual({ type: "object", properties: {} });
  });

  it("fills missing type and properties", () => {
    expect(normalizeJsonSchema({ properties: { x: { type: "string" } } })).toEqual({
      properties: { x: { type: "string" } },
      type: "object",
    });
  });
});

describe("mcpToolParameters", () => {
  it("returns flat JSON Schema from inputSchema", () => {
    const params = mcpToolParameters({
      inputSchema: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
    });
    expect(params).toEqual({
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    });
  });

  it("defaults to empty object schema", () => {
    expect(mcpToolParameters({})).toEqual({ type: "object", properties: {} });
  });
});

describe("toolParametersToMcpInputSchema", () => {
  it("normalizes ToolDef parameters", () => {
    expect(
      toolParametersToMcpInputSchema({
        properties: { q: { type: "string" } },
        required: ["q"],
      }),
    ).toEqual({
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"],
    });
  });
});

describe("handlerResultToMcpContent", () => {
  it("returns text content for success", () => {
    expect(handlerResultToMcpContent('{"ok":true}')).toEqual({
      content: [{ type: "text", text: '{"ok":true}' }],
    });
  });

  it("marks toolError JSON as isError", () => {
    const out = handlerResultToMcpContent('{"error":"bad query"}');
    expect(out.isError).toBe(true);
    expect(out.content[0]?.text).toBe("bad query");
  });
});

describe("extractMcpResult", () => {
  it("joins text content", () => {
    expect(
      extractMcpResult({
        content: [
          { type: "text", text: "line1" },
          { type: "text", text: "line2" },
        ],
      }),
    ).toBe("line1\nline2");
  });

  it("returns error JSON when isError", () => {
    const out = extractMcpResult({
      isError: true,
      content: [{ type: "text", text: "bad query" }],
    });
    expect(JSON.parse(out)).toEqual({ error: "bad query" });
  });
});
