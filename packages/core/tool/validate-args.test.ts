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

  it("rejects nested unknown fields by default", () => {
    const params: JsonSchemaObject = {
      type: "object",
      properties: {
        query: { type: "string" },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: { goal: { type: "string" } },
            required: ["goal"],
          },
        },
      },
      required: ["query"],
    };
    const result = validateToolArgs(params, {
      query: "hi",
      tasks: [{ goal: "do", extra: true }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/extra|Unrecognized/i);
    }
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

  it("allows nested extra keys when nested additionalProperties is true", () => {
    const params: JsonSchemaObject = {
      type: "object",
      properties: {
        patch: { type: "object", additionalProperties: true },
      },
      required: ["patch"],
    };
    const result = validateToolArgs(params, { patch: { foo: 1 } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.patch).toEqual({ foo: 1 });
    }
  });

  it("rejects missing required fields", () => {
    const result = validateToolArgs(baseParams, { limit: 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/query/i);
    }
  });

  it("allows null via anyOf for optional object fields", () => {
    const params: JsonSchemaObject = {
      type: "object",
      properties: {
        recurrence: {
          anyOf: [
            { type: "null" },
            {
              type: "object",
              properties: { freq: { type: "string" } },
              required: ["freq"],
            },
          ],
        },
      },
    };
    const cleared = validateToolArgs(params, { recurrence: null });
    expect(cleared.ok).toBe(true);
    const set = validateToolArgs(params, { recurrence: { freq: "daily" } });
    expect(set.ok).toBe(true);
    const extra = validateToolArgs(params, { recurrence: { freq: "daily", nope: true } });
    expect(extra.ok).toBe(false);
  });
});
