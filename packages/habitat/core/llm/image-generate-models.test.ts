import { describe, expect, it } from "bun:test";
import { filterAlibabaTokenPlanModels } from "./alibaba-token-plan-models.ts";
import {
  alibabaBuiltinImageGenerateEntries,
  filterImageGenerateCatalog,
  looksLikeImageGenerateModelId,
} from "./image-generate-models.ts";

describe("looksLikeImageGenerateModelId", () => {
  it("识别常见文生图 id", () => {
    expect(looksLikeImageGenerateModelId("gpt-image-1")).toBe(true);
    expect(looksLikeImageGenerateModelId("dall-e-3")).toBe(true);
    expect(looksLikeImageGenerateModelId("wan2.7-image")).toBe(true);
    expect(looksLikeImageGenerateModelId("qwen-image-3.0-pro")).toBe(true);
  });

  it("排除对话 / 视觉理解模型", () => {
    expect(looksLikeImageGenerateModelId("deepseek-chat")).toBe(false);
    expect(looksLikeImageGenerateModelId("qwen3.7-max")).toBe(false);
    expect(looksLikeImageGenerateModelId("qwen2.5-vl")).toBe(false);
  });
});

describe("alibaba token plan builtin", () => {
  it("图片生成仅含万相/千问文生图", () => {
    const rows = filterAlibabaTokenPlanModels({ capability: "图片生成" });
    expect(rows.map((r) => r.model).toSorted()).toEqual([
      "qwen-image-3.0-pro",
      "wan2.7-image",
      "wan2.7-image-pro",
    ]);
  });

  it("alibabaBuiltinImageGenerateEntries 不注入 gpt-image / dall-e", () => {
    const out = alibabaBuiltinImageGenerateEntries();
    expect(out.some((m) => m.model.startsWith("gpt-image") || m.model.startsWith("dall-e"))).toBe(
      false,
    );
    expect(out.map((m) => m.model)).toContain("wan2.7-image");
  });
});

describe("filterImageGenerateCatalog", () => {
  it("只过滤目录，不注入常用推荐", () => {
    const out = filterImageGenerateCatalog(
      [
        { model: "deepseek-chat", label: "DeepSeek", contextWindow: 1, maxOutputTokens: 1 },
        { model: "wan2.7-image", label: "Wan", contextWindow: 1, maxOutputTokens: 1 },
        {
          model: "unknown-img",
          label: "X",
          contextWindow: 1,
          maxOutputTokens: 1,
          outputModalities: ["image"],
        },
      ],
      { limit: 50 },
    );
    expect(out.map((m) => m.model)).toEqual(["wan2.7-image", "unknown-img"]);
    expect(out.some((m) => m.model === "gpt-image-1")).toBe(false);
  });
});
