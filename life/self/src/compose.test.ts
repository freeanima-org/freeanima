import { describe, it, expect } from "bun:test";
import type { SelfBlockKey } from "@freeanima/engine-repos";
import {
  SELF_BLOCK_HEADINGS,
  SELF_LAYER_PROMPT_HEADING,
  SELF_LAYER_SYSTEM_FRAME,
} from "./blocks.ts";
import { renderSelfLayerPrompt, wrapSelfLayerForSystemPrompt } from "./compose.ts";

describe("wrapSelfLayerForSystemPrompt", () => {
  it("含第二人称骨架、自我层标题与 md 围栏", () => {
    const inner = renderSelfLayerPrompt([
      {
        block_key: "self_model",
        content: "我是测试 Agent。",
        locked: false,
        version: 1,
        updated_by: null,
        created: "",
        updated: "",
      },
    ]);
    const wrapped = wrapSelfLayerForSystemPrompt(inner);

    expect(wrapped).toContain(SELF_LAYER_SYSTEM_FRAME);
    expect(wrapped).toContain(`## ${SELF_LAYER_PROMPT_HEADING}`);
    expect(wrapped).toContain("```md");
    expect(wrapped).toContain(`## ${SELF_BLOCK_HEADINGS.self_model}`);
    expect(wrapped).toContain("我是测试 Agent。");
  });

  it("空内容返回空字符串", () => {
    expect(wrapSelfLayerForSystemPrompt("")).toBe("");
    expect(wrapSelfLayerForSystemPrompt("   \n  ")).toBe("");
  });

  it("内层保留六块标题", () => {
    const keys = Object.keys(SELF_BLOCK_HEADINGS) as SelfBlockKey[];
    const inner = renderSelfLayerPrompt(
      keys.map((key) => ({
        block_key: key,
        content: `块-${key}`,
        locked: false,
        version: 0,
        updated_by: null,
        created: "",
        updated: "",
      })),
    );
    const wrapped = wrapSelfLayerForSystemPrompt(inner);
    for (const heading of Object.values(SELF_BLOCK_HEADINGS)) {
      expect(wrapped).toContain(`## ${heading}`);
    }
  });
});
