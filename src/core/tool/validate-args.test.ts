import { describe, expect, it } from "bun:test";
import { validateToolArgs } from "./validate-args.ts";
import type { JsonSchemaObject } from "./registry.ts";

const baseParams: JsonSchemaObject = {
  type: "object",
  properties: {
    query: { type: "string" },
    limit: { type: "number" },
  },
  required: ["query"],
};

describe("validateToolArgs", () => {
  it("accepts valid args", () => {
    const result = validateToolArgs(baseParams, { query: "hi", limit: 3 });
    expect(result).toEqual({ ok: true, data: { query: "hi", limit: 3 } });
  });

  it("rejects wrong types", () => {
    const result = validateToolArgs(baseParams, { query: "hi", limit: "3" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/^invalid tool arguments:/);
      expect(result.error).toMatch(/limit/i);
    }
  });

  it("rejects unknown fields by default", () => {
    const result = validateToolArgs(baseParams, { query: "hi", tags: ["x"] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/tags|Unrecognized/i);
    }
  });

  it("does not strip unknown fields into a success result", () => {
    const result = validateToolArgs(baseParams, { query: "hi", tags: ["x"] });
    expect(result.ok).toBe(false);
  });

  it("allows extra keys when additionalProperties is true", () => {
    const params: JsonSchemaObject = { ...baseParams, additionalProperties: true };
    const result = validateToolArgs(params, { query: "hi", tags: ["x"] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.query).toBe("hi");
      expect(result.data.tags).toEqual(["x"]);
    }
  });

  it("rejects missing required fields", () => {
    const result = validateToolArgs(baseParams, { limit: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/query/i);
    }
  });
});
