import { describe, it, expect } from "bun:test";
import type { SelfBlockKey } from "@freeanima/storage-repos";
import {
  SELF_BLOCK_HEADINGS,
  SELF_LAYER_PROMPT_HEADING,
  SELF_LAYER_SYSTEM_FRAME,
} from "./blocks.ts";
import { renderSelfLayerPrompt, wrapSelfLayerForSystemPrompt } from "./compose.ts";

describe("wrapSelfLayerForSystemPrompt", () => {
  it("includes second-person frame, self-layer heading, and md fence", () => {
    const inner = renderSelfLayerPrompt([
      {
        block_key: "self_model",
        content: "I am a test Agent.",
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
    expect(wrapped).toContain("I am a test Agent.");
  });

  it("returns empty string for empty content", () => {
    expect(wrapSelfLayerForSystemPrompt("")).toBe("");
    expect(wrapSelfLayerForSystemPrompt("   \n  ")).toBe("");
  });

  it("preserves six-block headings in inner content", () => {
    const keys = Object.keys(SELF_BLOCK_HEADINGS) as SelfBlockKey[];
    const inner = renderSelfLayerPrompt(
      keys.map((key) => ({
        block_key: key,
        content: `block-${key}`,
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
