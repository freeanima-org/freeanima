import { afterEach, describe, expect, it } from "bun:test";
import { animaConfigSchema, Config, parseYaml } from "@freeanima/platform/config";
import { bindActiveConfig, resetActiveConfigForTest } from "@freeanima/platform/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";

import { buildFtsTsQuery } from "./query.ts";
import { resetJiebaForTest } from "./segment.ts";

function minimalConfig() {
  const parsed = animaConfigSchema.safeParse(parseYaml(MINIMAL_LLM_YAML));
  if (!parsed.success) throw new Error(parsed.error.message);
  return parsed.data;
}

describe("buildFtsTsQuery", () => {
  afterEach(() => {
    resetActiveConfigForTest();
    resetJiebaForTest();
  });

  it("uses char proximity mode for OR queries when jieba disabled", async () => {
    bindActiveConfig(Config.fromSnapshot({ ...minimalConfig(), cjk: { enabled: false } }));
    const tsq = await buildFtsTsQuery("退烧 OR 方向 摇摆");
    expect(tsq).toBe("(退 <-> 烧) | (方 <-> 向) & (摇 <-> 摆)");
  });

  it("uses jieba operator mode when jieba enabled", async () => {
    bindActiveConfig(Config.fromSnapshot({ ...minimalConfig(), cjk: { enabled: true } }));
    const tsq = await buildFtsTsQuery("退烧 OR 方向 摇摆");
    expect(tsq).toContain("|");
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("validates input before building", async () => {
    bindActiveConfig(Config.fromSnapshot(minimalConfig()));
    await expect(buildFtsTsQuery("退烧 OR")).rejects.toThrow("query 不能以 OR 结尾");
  });
});
