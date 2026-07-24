import { describe, expect, it } from "bun:test";

import { isRuntimeConfigSectionKey } from "./runtime-config.ts";

describe("isRuntimeConfigSectionKey", () => {
  it("识别已知运行时段", () => {
    expect(isRuntimeConfigSectionKey("gateway")).toBe(true);
    expect(isRuntimeConfigSectionKey("tts")).toBe(true);
    expect(isRuntimeConfigSectionKey("llm")).toBe(true);
  });

  it("排除 bootstrap 与未知段", () => {
    expect(isRuntimeConfigSectionKey("database")).toBe(false);
    expect(isRuntimeConfigSectionKey("http")).toBe(false);
    expect(isRuntimeConfigSectionKey("no_such_section")).toBe(false);
  });
});
