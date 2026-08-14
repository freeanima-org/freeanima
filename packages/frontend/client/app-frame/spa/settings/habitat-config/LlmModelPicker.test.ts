import { describe, expect, test } from "bun:test";

import { modelSubtitle } from "./LlmModelPicker.tsx";

describe("modelSubtitle", () => {
  test("追加输入模态中文标签（含文字）", () => {
    expect(
      modelSubtitle({
        model: "mimo-v2.5",
        contextWindow: 1_000_000,
        maxOutputTokens: 8192,
        cost: { input: 0.14, output: 0.28 },
        inputModalities: ["text", "image", "audio", "video"],
      }),
    ).toBe("ctx 1M · $0.14/$0.28/1M · 文字 · 图片 · 音频 · 视频");
  });

  test("仅文字时只标文字", () => {
    expect(
      modelSubtitle({
        model: "mimo-v2.5-pro",
        contextWindow: 1_000_000,
        maxOutputTokens: 8192,
        inputModalities: ["text"],
      }),
    ).toBe("ctx 1M · 文字");
  });

  test("未知模态时不臆造标签", () => {
    expect(
      modelSubtitle({
        model: "hand-filled",
        contextWindow: 128_000,
        maxOutputTokens: 8192,
      }),
    ).toBe("ctx 128k");
  });
});
