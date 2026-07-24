import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
  animaConfigSchema,
  Config,
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "@freeanima/host/core/config";

const segmentForFtsMock = mock(async (_text: string) => {
  throw new Error("jieba failed");
});

mock.module("./segment.ts", () => ({
  segmentForFts: segmentForFtsMock,
}));

import { resolveFtsSegmentedForWrite } from "./write.ts";

function jiebaEnabledConfig(): Config {
  return Config.fromSnapshot(
    animaConfigSchema.parse({
      llm: {
        default_profile: "chat",
        providers: {
          main: { backend: "openai_compatible", base_url: "http://localhost", api_key: "test" },
        },
        profiles: { chat: { chain: [{ provider: "main", model: "test" }] } },
      },
      cjk: { enabled: true },
    }),
  );
}

describe("resolveFtsSegmentedForWrite", () => {
  beforeEach(() => {
    bindActiveRuntimeConfig(jiebaEnabledConfig());
  });

  afterEach(() => {
    resetActiveConfigForTest();
    segmentForFtsMock.mockClear();
  });

  it("returns null when segmentation throws", async () => {
    const out = await resolveFtsSegmentedForWrite("hello world");
    expect(out).toBeNull();
    expect(segmentForFtsMock).toHaveBeenCalledTimes(1);
  });
});
