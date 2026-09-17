import { describe, expect, it } from "bun:test";
import {
  alibabaMultimodalGenerationUrl,
  normalizeAlibabaImageSize,
} from "./images-alibaba-multimodal.ts";

describe("alibaba multimodal image helpers", () => {
  it("从 OpenAI 兼容根推导 generation URL", () => {
    expect(
      alibabaMultimodalGenerationUrl(
        "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      ),
    ).toBe(
      "https://token-plan.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation",
    );
  });

  it("规范化 size", () => {
    expect(normalizeAlibabaImageSize("1024x1024")).toBe("1024*1024");
    expect(normalizeAlibabaImageSize("2K")).toBe("2K");
    expect(normalizeAlibabaImageSize("1024*1024")).toBe("1024*1024");
  });
});
