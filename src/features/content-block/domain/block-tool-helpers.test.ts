import { describe, expect, it } from "bun:test";

import {
  parseBlockType,
  parseLimbic,
  parseNarrative,
  parseSemanticComponent,
  parseSemanticRef,
} from "./block-tool-helpers.ts";

describe("content-block tool helpers", () => {
  it("parseBlockType accepts known types", () => {
    expect(parseBlockType("text")).toBe("text");
    expect(parseBlockType("link_card")).toBe("link_card");
    expect(parseBlockType("markdown")).toBeNull();
  });

  it("parseSemanticComponent accepts limbic/narrative/semantic_ref/dream", () => {
    expect(parseSemanticComponent("limbic")).toBe("limbic");
    expect(parseSemanticComponent("dream")).toBe("dream");
    expect(parseSemanticComponent("task_item")).toBeNull();
  });

  it("parseLimbic validates numeric fields", () => {
    expect(parseLimbic({ valence: 0.1, arousal: 0.2, intensity: 0.3 })).toEqual({
      valence: 0.1,
      arousal: 0.2,
      intensity: 0.3,
    });
    expect(parseLimbic(null)).toBeNull();
    expect(parseLimbic({ valence: "x", arousal: 0, intensity: 0 })).toBeNull();
  });

  it("parseNarrative and parseSemanticRef", () => {
    expect(parseNarrative({ significance: "milestone" })).toEqual({
      significance: "milestone",
    });
    expect(parseNarrative({ significance: "nope" })).toBeNull();
    expect(parseSemanticRef({ semantic_memory_id: "sm-1" })).toEqual({
      semantic_memory_id: "sm-1",
    });
    expect(parseSemanticRef({ semantic_memory_id: "" })).toBeNull();
  });
});
