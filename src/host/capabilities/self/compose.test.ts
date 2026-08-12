import { describe, it, expect } from "bun:test";
import type { SelfBlockKey } from "@freeanima/host/core/db/pg/self-layer/types";
import { SELF_BLOCK_HEADINGS, SELF_LAYER_SYSTEM_FRAME } from "./blocks.ts";
import { renderSelfLayerPrompt, wrapSelfLayerForSystemPrompt } from "./compose.ts";

describe("wrapSelfLayerForSystemPrompt", () => {
  it("includes second-person frame, outer self_layer, and nested block tags", () => {
    const inner = renderSelfLayerPrompt([
      {
        block_key: "self_model",
        content: "I am a test Agent.",
        locked: false,
        version: 1,
        updated_by: null,
        created_at: new Date(0),
        updated_at: new Date(0),
      },
    ]);
    const wrapped = wrapSelfLayerForSystemPrompt(inner);

    expect(wrapped).toContain(SELF_LAYER_SYSTEM_FRAME);
    expect(wrapped).toContain("<self_layer>");
    expect(wrapped).toContain("</self_layer>");
    expect(wrapped).toContain("<self_model>");
    expect(wrapped).toContain("I am a test Agent.");
    expect(wrapped).not.toContain("```md");
    expect(wrapped).not.toContain(`## ${SELF_BLOCK_HEADINGS.self_model}`);
  });

  it("returns empty string for empty content", () => {
    expect(wrapSelfLayerForSystemPrompt("")).toBe("");
    expect(wrapSelfLayerForSystemPrompt("   \n  ")).toBe("");
  });

  it("preserves five block keys as nested XML tags", () => {
    const keys = Object.keys(SELF_BLOCK_HEADINGS) as SelfBlockKey[];
    const inner = renderSelfLayerPrompt(
      keys.map((key) => ({
        block_key: key,
        content: `block-${key}`,
        locked: false,
        version: 0,
        updated_by: null,
        created_at: new Date(0),
        updated_at: new Date(0),
      })),
    );
    const wrapped = wrapSelfLayerForSystemPrompt(inner);
    for (const key of keys) {
      expect(wrapped).toContain(`<${key}>`);
      expect(wrapped).toContain(`</${key}>`);
      expect(wrapped).toContain(`block-${key}`);
    }
  });
});
