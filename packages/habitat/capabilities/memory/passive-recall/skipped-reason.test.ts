import { describe, expect, it } from "bun:test";

import type { PassiveRecallDebugTrace } from "./debug-types.ts";
import { classifyPassiveRecallNoHits } from "./skipped-reason.ts";

function base(): PassiveRecallDebugTrace {
  return {
    query: "q",
    tsquery: null,
    effective_min_score: 0,
    min_score: 0,
    min_relative_score: 0,
    fts: [],
    trgm: [],
    merged: [],
    after_score_filter: [],
    after_resident_filter: [],
    excluded_resident_ids: [],
    injected: [],
    elapsed_ms: 0,
  };
}

describe("classifyPassiveRecallNoHits", () => {
  it("returns no_hits when merged empty", () => {
    expect(classifyPassiveRecallNoHits(base())).toBe("no_hits");
  });

  it("returns filtered_by_score when merged has rows but score filter empty", () => {
    const d = base();
    d.merged = [{ id: 1, score: 0.01, content_preview: "x" }];
    expect(classifyPassiveRecallNoHits(d)).toBe("filtered_by_score");
  });

  it("returns filtered_by_resident when score passed but resident emptied", () => {
    const d = base();
    d.merged = [{ id: 1, score: 0.02, content_preview: "x" }];
    d.after_score_filter = [{ id: 1, score: 0.02, content_preview: "x" }];
    expect(classifyPassiveRecallNoHits(d)).toBe("filtered_by_resident");
  });

  it("returns filtered_by_current_conversation when current-session filter emptied", () => {
    const d = base();
    d.merged = [{ id: 1, score: 0.02, content_preview: "x" }];
    d.after_score_filter = [{ id: 1, score: 0.02, content_preview: "x" }];
    d.excluded_current_conversation_ids = [1];
    expect(classifyPassiveRecallNoHits(d)).toBe("filtered_by_current_conversation");
  });
});
