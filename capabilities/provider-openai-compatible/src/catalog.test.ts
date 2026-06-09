import { describe, expect, it } from "bun:test";
import { defaultModelInfo, findModelInCatalog } from "./catalog.ts";

describe("defaultModelInfo", () => {
  it("为未知模型提供默认窗口与参数", () => {
    const info = defaultModelInfo("custom-model");
    expect(info.model).toBe("custom-model");
    expect(info.contextWindow).toBe(128_000);
    expect(info.supportedParams).toContain("streaming");
  });
});

describe("findModelInCatalog", () => {
  it("按 model id 查找", () => {
    const catalog = [defaultModelInfo("a"), defaultModelInfo("b")];
    expect(findModelInCatalog(catalog, "b")?.model).toBe("b");
    expect(findModelInCatalog(catalog, "missing")).toBeNull();
  });
});
