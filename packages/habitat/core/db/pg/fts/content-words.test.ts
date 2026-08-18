import { afterEach, describe, expect, it } from "bun:test";
import { runtimeConfigSchema, Config } from "@freeanima/habitat/core/config";
import { bindActiveRuntimeConfig, resetActiveConfigForTest } from "@freeanima/habitat/core/config";

import { extractContentWords, isContentPosTag, isFtsQueryStopword } from "./content-words.ts";
import { resetJiebaForTest } from "./segment.ts";

function minimalConfig(cjkEnabled: boolean) {
  return runtimeConfigSchema.parse({
    connections: {
      main: {
        preset: "custom",
        custom_kind: "text",
        text_protocol: "openai_compatible",
        base_url: "http://localhost",
        api_key: "test",
      },
    },
    text_generate: { main: { connection: "main", model: "test" } },
    cjk: { enabled: cjkEnabled },
  });
}

describe("content-words", () => {
  afterEach(() => {
    resetActiveConfigForTest();
    resetJiebaForTest();
  });

  it("classifies stopwords and POS tags", () => {
    expect(isFtsQueryStopword("是")).toBe(true);
    expect(isFtsQueryStopword("什么")).toBe(true);
    expect(isFtsQueryStopword("风油精")).toBe(false);
    expect(isContentPosTag("n")).toBe(true);
    expect(isContentPosTag("nz")).toBe(true);
    expect(isContentPosTag("v")).toBe(true);
    expect(isContentPosTag("r")).toBe(false);
    expect(isContentPosTag("uj")).toBe(false);
  });

  it("keeps content nouns/verbs and drops 是/什么", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot(minimalConfig(true)));
    const result = await extractContentWords("风油精是什么");
    expect(result.fell_back).toBe(false);
    expect(result.words).toContain("风油精");
    expect(result.words).not.toContain("是");
    expect(result.words).not.toContain("什么");
    expect(result.query).toContain("风油精");
  });

  it("keeps 喜欢/吃/汉堡 from a natural sentence", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot(minimalConfig(true)));
    const result = await extractContentWords("我真的很喜欢吃大大的汉堡");
    expect(result.fell_back).toBe(false);
    expect(result.words).toContain("喜欢");
    expect(result.words).toContain("吃");
    expect(result.words.some((w) => w.includes("汉堡") || w === "汉堡")).toBe(true);
    expect(result.words).not.toContain("我");
    expect(result.words).not.toContain("真的");
  });

  it("falls back to original when only stopwords remain", async () => {
    bindActiveRuntimeConfig(Config.fromSnapshot(minimalConfig(true)));
    const result = await extractContentWords("什么是");
    expect(result.fell_back).toBe(true);
    expect(result.query).toBe("什么是");
  });
});
