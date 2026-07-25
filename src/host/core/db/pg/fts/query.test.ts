import { afterEach, describe, expect, it } from "bun:test";
import { runtimeConfigSchema, Config } from "@freeanima/host/core/config";
import { bindActiveRuntimeConfig, resetActiveConfigForTest } from "@freeanima/host/core/config";

import { buildFtsTsQuery } from "./query.ts";
import { resetJiebaForTest } from "./segment.ts";

function minimalConfig() {
  return runtimeConfigSchema.parse({
    llm: {
      default_profile: "chat",
      providers: {
        main: { backend: "openai_compatible", base_url: "http://localhost", api_key: "test" },
      },
      profiles: { chat: { chain: [{ provider: "main", model: "test" }] } },
    },
  });
}

describe("buildFtsTsQuery", () => {
  afterEach(() => {
    resetActiveConfigForTest();
    resetJiebaForTest();
  });

  it("uses char proximity mode for OR queries when jieba disabled", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot({ ...minimalConfig(), cjk: { enabled: false } }));
    const tsq = await buildFtsTsQuery("退烧 OR 方向 摇摆");
    expect(tsq).toBe("(退 <-> 烧) | (方 <-> 向) & (摇 <-> 摆)");
  });

  it("uses jieba operator mode when jieba enabled", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot({ ...minimalConfig(), cjk: { enabled: true } }));
    const tsq = await buildFtsTsQuery("退烧 OR 方向 摇摆");
    expect(tsq).toContain("|");
    expect(tsq).not.toMatch(/\)\s+\(/);
  });

  it("validates input before building", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot(minimalConfig()));
    await expect(buildFtsTsQuery("退烧 OR")).rejects.toThrow("query 不能以 OR 结尾");
  });
});
