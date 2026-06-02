import { describe, it, expect } from "bun:test";
import { extractMcpResult, mcpToolParameters } from "@freeanima/legacy-integrations";

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
