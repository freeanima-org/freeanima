import { afterEach, describe, expect, it } from "bun:test";
import {
  runtimeConfigSchema,
  Config,
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "@freeanima/habitat/core/config";

import { resolveFtsSegmentedForWrite } from "./write.ts";
import { resetJiebaForTest } from "./segment.ts";

function configWithCjk(enabled: boolean): Config {
  return Config.fromSnapshot(
    runtimeConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: { backend: "openai_compatible", base_url: "http://localhost", api_key: "test" },
        },
        profiles: { chat: { chain: [{ provider: "main", model: "test" }] } },
      },
      cjk: { enabled },
    }),
  );
}

describe("resolveFtsSegmentedForWrite", () => {
  afterEach(() => {
    resetActiveConfigForTest();
    resetJiebaForTest();
  });

  it("returns null when cjk disabled", async () => {
    bindActiveRuntimeConfig(configWithCjk(false));
    expect(await resolveFtsSegmentedForWrite("风油精是什么")).toBeNull();
  });

  it("returns jieba-segmented text when cjk enabled", async () => {
    bindActiveRuntimeConfig(configWithCjk(true));
    const out = await resolveFtsSegmentedForWrite("风油精是什么");
    expect(out).toBe("风油精 是 什么");
  });
});
