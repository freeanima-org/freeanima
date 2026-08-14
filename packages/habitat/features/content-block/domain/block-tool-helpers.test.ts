import { describe, expect, it } from "bun:test";

import {
  applyContentBlockSearchOrder,
  clampContentBlockLimbicRange,
  parseBlockType,
  parseLimbic,
  parseLimbicKind,
  parseNarrative,
  parseSearchOrderBy,
  parseSemanticComponent,
  parseSemanticRef,
} from "./block-tool-helpers.ts";
import type { ContentBlockRow } from "./types.ts";

function row(partial: Partial<ContentBlockRow> & Pick<ContentBlockRow, "id">): ContentBlockRow {
  return {
    title: "",
    content: "",
    summary: "",
    block_type: "text",
    parent_id: 1,
    sort_order: 0,
    url: null,
    client_op_id: null,
    components: ["content_block", "limbic"],
    limbic: null,
    narrative: null,
    semantic_ref: null,
    dream: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

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

  it("parseLimbic validates numeric fields and optional provenance", () => {
    expect(parseLimbic({ valence: 0.1, arousal: 0.2, intensity: 0.3 })).toEqual({
      valence: 0.1,
      arousal: 0.2,
      intensity: 0.3,
    });
    expect(
      parseLimbic({
        valence: 0.1,
        arousal: 0.2,
        intensity: 0.3,
        kind: "spike",
        conversation_id: "c1",
        source_segment: null,
        semantic_memory_ids: [9],
      }),
    ).toEqual({
      valence: 0.1,
      arousal: 0.2,
      intensity: 0.3,
      kind: "spike",
      conversation_id: "c1",
      source_segment: null,
      semantic_memory_ids: [9],
    });
    expect(parseLimbic(null)).toBeNull();
    expect(parseLimbic({ valence: "x", arousal: 0, intensity: 0 })).toBeNull();
    expect(parseLimbicKind("turning_point")).toBe("turning_point");
    expect(parseLimbicKind("nope")).toBeNull();
  });

  it("parseNarrative and parseSemanticRef", () => {
    expect(parseNarrative({ significance: "milestone" })).toEqual({
      significance: "milestone",
    });
    expect(
      parseNarrative({
        significance: "normal",
        status: "active",
        period_start: "2026-01",
        period_end: null,
        source_facts: [1],
        source_conversations: ["c1"],
      }),
    ).toEqual({
      significance: "normal",
      status: "active",
      period_start: "2026-01",
      period_end: null,
      source_facts: [1],
      source_conversations: ["c1"],
    });
    expect(parseNarrative({ significance: "nope" })).toBeNull();
    expect(parseSemanticRef({ entity_id: 42 })).toEqual({
      entity_id: 42,
    });
    expect(parseSemanticRef({ entity_id: 0 })).toBeNull();
    expect(parseSemanticRef({ entity_id: "x" })).toBeNull();
  });

  it("parseSearchOrderBy accepts known orders", () => {
    expect(parseSearchOrderBy("intensity_desc")).toBe("intensity_desc");
    expect(parseSearchOrderBy("nope")).toBeNull();
  });

  it("clampContentBlockLimbicRange filters intensity/valence", () => {
    const rows = [
      row({
        id: 1,
        limbic: { valence: -0.5, arousal: 0.2, intensity: 0.2 },
      }),
      row({
        id: 2,
        limbic: { valence: 0.8, arousal: 0.5, intensity: 0.9 },
      }),
      row({ id: 3, limbic: null }),
    ];
    expect(clampContentBlockLimbicRange(rows, { minIntensity: 0.5 }).map((r) => r.id)).toEqual([2]);
    expect(clampContentBlockLimbicRange(rows, { minValence: 0 }).map((r) => r.id)).toEqual([2]);
  });

  it("applyContentBlockSearchOrder sorts by intensity/created", () => {
    const rows = [
      row({
        id: 1,
        created_at: "2026-01-01T00:00:00.000Z",
        limbic: { valence: 0.1, arousal: 0.1, intensity: 0.2 },
      }),
      row({
        id: 2,
        created_at: "2026-01-03T00:00:00.000Z",
        limbic: { valence: -0.2, arousal: 0.1, intensity: 0.9 },
      }),
      row({
        id: 3,
        created_at: "2026-01-02T00:00:00.000Z",
        limbic: { valence: 0.5, arousal: 0.1, intensity: 0.5 },
      }),
    ];
    expect(applyContentBlockSearchOrder(rows, "intensity_desc").map((r) => r.id)).toEqual([
      2, 3, 1,
    ]);
    expect(applyContentBlockSearchOrder(rows, undefined).map((r) => r.id)).toEqual([2, 3, 1]);
    expect(applyContentBlockSearchOrder(rows, "created_asc").map((r) => r.id)).toEqual([1, 3, 2]);
  });
});
