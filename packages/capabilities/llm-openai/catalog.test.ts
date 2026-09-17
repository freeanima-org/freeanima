import { describe, expect, it } from "bun:test";
import { defaultModelInfo, findModelInCatalog, inferContextWindow } from "./catalog.ts";

describe("defaultModelInfo", () => {
  it("provides default window and params for unknown models", () => {
    const info = defaultModelInfo("custom-model");
    expect(info.model).toBe("custom-model");
    expect(info.contextWindow).toBe(128_000);
    expect(info.supportedParams).toContain("streaming");
  });
});

describe("inferContextWindow", () => {
  it("reads OpenRouter context_length", () => {
    expect(inferContextWindow({ id: "m", context_length: 200_000 } as never)).toBe(200_000);
  });

  it("reads max_model_len fallback", () => {
    expect(inferContextWindow({ id: "m", max_model_len: 32_768 } as never)).toBe(32_768);
  });

  it("defaults when API omits window fields", () => {
    expect(inferContextWindow({ id: "m" } as never)).toBe(128_000);
  });
});

describe("findModelInCatalog", () => {
  it("finds by model id", () => {
    const catalog = [defaultModelInfo("a"), defaultModelInfo("b")];
    expect(findModelInCatalog(catalog, "b")?.model).toBe("b");
    expect(findModelInCatalog(catalog, "missing")).toBeNull();
  });
});
