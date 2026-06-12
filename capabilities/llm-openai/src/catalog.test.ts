import { describe, expect, it } from "bun:test";
import { defaultModelInfo, findModelInCatalog } from "./catalog.ts";

describe("defaultModelInfo", () => {
  it("provides default window and params for unknown models", () => {
    const info = defaultModelInfo("custom-model");
    expect(info.model).toBe("custom-model");
    expect(info.contextWindow).toBe(128_000);
    expect(info.supportedParams).toContain("streaming");
  });
});

describe("findModelInCatalog", () => {
  it("finds by model id", () => {
    const catalog = [defaultModelInfo("a"), defaultModelInfo("b")];
    expect(findModelInCatalog(catalog, "b")?.model).toBe("b");
    expect(findModelInCatalog(catalog, "missing")).toBeNull();
  });
});
