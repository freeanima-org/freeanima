import { describe, expect, it } from "bun:test";
import { factExtractionSchema } from "./fact-extraction.ts";

describe("factExtractionSchema", () => {
  it("parses facts and summary", () => {
    const parsed = factExtractionSchema.parse({
      facts: [{ content: "User likes coffee", type: "preference" }],
      summary: "Dietary preferences",
    });
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.summary).toBe("Dietary preferences");
  });

  it("uses default empty values for missing fields", () => {
    const parsed = factExtractionSchema.parse({});
    expect(parsed.facts).toEqual([]);
    expect(parsed.summary).toBe("");
  });

  it("rejects non-object facts", () => {
    expect(() => factExtractionSchema.parse({ facts: "bad" })).toThrow();
  });
});
