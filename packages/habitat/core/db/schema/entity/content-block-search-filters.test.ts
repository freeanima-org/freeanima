import { describe, expect, it } from "bun:test";

import { parseContentBlockSearchFilters } from "./content-block-search-filters.ts";

describe("parseContentBlockSearchFilters", () => {
  it("accepts content_block filter shape", () => {
    const parsed = parseContentBlockSearchFilters({
      parent_id: 10,
      block_type: "text",
      client_op_id: "op-1",
      conversation_id: "conv-42",
    });
    expect(parsed.parent_id).toBe(10);
    expect(parsed.block_type).toBe("text");
    expect(parsed.client_op_id).toBe("op-1");
    expect(parsed.conversation_id).toBe("conv-42");
  });

  it("accepts conversation_id filter", () => {
    const parsed = parseContentBlockSearchFilters({ conversation_id: "sess-legacy" });
    expect(parsed.conversation_id).toBe("sess-legacy");
  });

  it("rejects unknown fields", () => {
    expect(() => parseContentBlockSearchFilters({ foo: "bar" })).toThrow(
      /invalid content_block filters/,
    );
  });

  it("rejects invalid block_type", () => {
    expect(() => parseContentBlockSearchFilters({ block_type: "markdown" })).toThrow(
      /invalid content_block filters/,
    );
  });
});
