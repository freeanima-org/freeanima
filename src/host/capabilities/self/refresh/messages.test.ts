import { describe, expect, it } from "bun:test";
import type { SemanticMemoryRow } from "@freeanima/host/core/db/schema/rows";

import {
  buildSelfLayerRefreshUserMessage,
  formatProposalNotificationBody,
  parseSelfLayerRefreshResponse,
  SELF_LAYER_REFRESH_INSTRUCTION,
} from "./messages.ts";

function fact(
  partial: Partial<SemanticMemoryRow> & { id: number; content: string },
): SemanticMemoryRow {
  return {
    type: "experience",
    pinned: false,
    reference_count: 3,
    source_conversations: [],
    observed_at: null,
    occurred_at: null,
    status: "active",
    world_id: 1,
    created_at: new Date(0),
    updated_at: new Date(0),
    ...partial,
  };
}

describe("parseSelfLayerRefreshResponse", () => {
  it("returns no proposal for empty or invalid JSON", () => {
    expect(parseSelfLayerRefreshResponse("")).toEqual({ propose: false });
    expect(parseSelfLayerRefreshResponse("not json")).toEqual({ propose: false });
    expect(parseSelfLayerRefreshResponse('{"propose":false}')).toEqual({ propose: false });
  });

  it("parses propose=true with maintainable blocks only", () => {
    const parsed = parseSelfLayerRefreshResponse(
      JSON.stringify({
        propose: true,
        rationale: "Long-term evidence",
        evidence_ids: [42, "7", 42],
        blocks: {
          self_model: "I am more careful with tools.",
          existence_anchor: "should be ignored",
          personality_baseline: "  ",
          direction: "Focus on continuity.",
        },
      }),
    );
    expect(parsed).toEqual({
      propose: true,
      rationale: "Long-term evidence",
      evidence_ids: [42, 7],
      blocks: {
        self_model: "I am more careful with tools.",
        direction: "Focus on continuity.",
      },
    });
  });

  it("strips markdown fences", () => {
    const parsed = parseSelfLayerRefreshResponse(
      '```json\n{"propose":true,"blocks":{"metacognition":"Think slower."}}\n```',
    );
    expect(parsed.propose).toBe(true);
    if (parsed.propose) {
      expect(parsed.blocks.metacognition).toBe("Think slower.");
    }
  });
});

describe("buildSelfLayerRefreshUserMessage", () => {
  it("includes evidence markers and instruction", () => {
    const msg = buildSelfLayerRefreshUserMessage(
      [
        fact({
          id: 9,
          content: "Partner prefers direct answers",
          pinned: true,
          reference_count: 5,
        }),
      ],
      [
        {
          block_key: "self_model",
          heading: "Self model",
          content: "I am a helper.",
          locked: false,
          version: 1,
        },
      ],
    );
    expect(msg).toContain("[[anima:9]]");
    expect(msg).toContain("Partner prefers direct answers");
    expect(msg).toContain("I am a helper.");
    expect(msg).toContain(SELF_LAYER_REFRESH_INSTRUCTION);
  });
});

describe("formatProposalNotificationBody", () => {
  it("includes handling instructions and block content", () => {
    const body = formatProposalNotificationBody({
      propose: true,
      rationale: "Refs accumulated",
      evidence_ids: [1],
      blocks: { direction: "Ship slowly." },
    });
    expect(body).toContain("征询是否采纳");
    expect(body).toContain("Ship slowly.");
    expect(body).toContain("[[anima:1]]");
  });
});
