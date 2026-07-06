import { describe, expect, it } from "bun:test";

import {
  buildSearchQueries,
  deriveBaseModelNames,
  stripOllamaTag,
  toTitleKebabModel,
} from "./normalize.ts";

describe("stripOllamaTag", () => {
  it("strips tag after colon", () => {
    expect(stripOllamaTag("qwen2.5:7b")).toBe("qwen2.5");
  });

  it("returns trimmed name when no tag", () => {
    expect(stripOllamaTag("  deepseek-v4  ")).toBe("deepseek-v4");
  });
});

describe("deriveBaseModelNames", () => {
  it("strips variant suffixes progressively", () => {
    const names = deriveBaseModelNames("deepseek-v4-flash");
    expect(names[0]).toBe("deepseek-v4-flash");
    expect(names).toContain("deepseek-v4");
  });

  it("returns org/name unchanged", () => {
    expect(deriveBaseModelNames("BAAI/bge-m3")).toEqual(["BAAI/bge-m3"]);
  });
});

describe("buildSearchQueries", () => {
  it("generates hyphen/underscore variants", () => {
    const queries = buildSearchQueries("deepseek_v4");
    expect(queries).toContain("deepseek_v4");
    expect(queries).toContain("deepseek-v4");
  });

  it("returns empty for org/name models", () => {
    expect(buildSearchQueries("org/model")).toEqual([]);
  });
});

describe("toTitleKebabModel", () => {
  it("title-cases segments and uppercases vN", () => {
    expect(toTitleKebabModel("deepseek-v4-flash")).toBe("Deepseek-V4-Flash");
  });
});
