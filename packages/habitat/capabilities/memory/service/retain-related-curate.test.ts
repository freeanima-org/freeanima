import { describe, expect, it } from "bun:test";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import { cstDayRange } from "../day-window/build-messages.ts";
import {
  RETAIN_PASSIVE_MIN_RELATIVE_SCORE,
  RETAIN_PASSIVE_MIN_SCORE,
  RETAIN_RELATED_TODAY_MIN_RELATIVE_SCORE,
  RETAIN_RELATED_TODAY_MIN_SCORE,
  isMemoryActiveOnCstDay,
  mergeRetainRelatedCurated,
  memorySortTimeMs,
} from "./retain-related-curate.ts";

function row(
  overrides: Partial<SemanticMemoryRow> & { id: number; content: string },
): SemanticMemoryRow {
  const now = new Date("2026-08-20T04:00:00.000Z");
  return {
    type: "world",
    pinned: false,
    source_conversations: ["conv-1"],
    observed_at: now,
    occurred_at: null,
    status: "active",
    reference_count: 0,
    created_at: now,
    updated_at: now,
    world_id: 1,
    ...overrides,
  };
}

describe("retain-related-curate constants", () => {
  it("keeps retain passive threshold above working defaults", () => {
    expect(RETAIN_PASSIVE_MIN_SCORE).toBeGreaterThan(0.016);
    expect(RETAIN_PASSIVE_MIN_RELATIVE_SCORE).toBeGreaterThan(0.55);
  });

  it("keeps today-related threshold at or below working defaults", () => {
    expect(RETAIN_RELATED_TODAY_MIN_SCORE).toBeLessThanOrEqual(0.016);
    expect(RETAIN_RELATED_TODAY_MIN_RELATIVE_SCORE).toBeLessThanOrEqual(0.55);
  });
});

describe("mergeRetainRelatedCurated", () => {
  it("dedupes and keeps newest five by updated_at", () => {
    const recent = [
      row({ id: 1, content: "a", updated_at: new Date("2026-08-20T10:00:00.000Z") }),
      row({ id: 2, content: "b", updated_at: new Date("2026-08-20T09:00:00.000Z") }),
      row({ id: 3, content: "c", updated_at: new Date("2026-08-20T08:00:00.000Z") }),
    ];
    const todaySemantic = [
      row({ id: 2, content: "b-dup", updated_at: new Date("2026-08-20T09:00:00.000Z") }),
      row({ id: 4, content: "d", updated_at: new Date("2026-08-20T11:00:00.000Z") }),
      row({ id: 5, content: "e", updated_at: new Date("2026-08-20T07:00:00.000Z") }),
      row({ id: 6, content: "f", updated_at: new Date("2026-08-20T06:00:00.000Z") }),
    ];
    const out = mergeRetainRelatedCurated({ recent, todaySemantic });
    expect(out.map((r) => r.id)).toEqual([4, 1, 2, 3, 5]);
    expect(out).toHaveLength(5);
  });

  it("allows sparse 3+1 composition", () => {
    const recent = [
      row({ id: 1, content: "a", updated_at: new Date("2026-08-20T10:00:00.000Z") }),
      row({ id: 2, content: "b", updated_at: new Date("2026-08-20T09:00:00.000Z") }),
      row({ id: 3, content: "c", updated_at: new Date("2026-08-20T08:00:00.000Z") }),
    ];
    const todaySemantic = [
      row({ id: 9, content: "only-today", updated_at: new Date("2026-08-20T07:30:00.000Z") }),
    ];
    const out = mergeRetainRelatedCurated({ recent, todaySemantic });
    expect(out.map((r) => r.id)).toEqual([1, 2, 3, 9]);
  });

  it("allows sparse 2+1 composition", () => {
    const recent = [
      row({ id: 1, content: "a", updated_at: new Date("2026-08-20T10:00:00.000Z") }),
      row({ id: 2, content: "b", updated_at: new Date("2026-08-20T09:00:00.000Z") }),
    ];
    const todaySemantic = [
      row({ id: 8, content: "t", updated_at: new Date("2026-08-20T11:00:00.000Z") }),
    ];
    expect(mergeRetainRelatedCurated({ recent, todaySemantic }).map((r) => r.id)).toEqual([
      8, 1, 2,
    ]);
  });
});

describe("isMemoryActiveOnCstDay", () => {
  it("matches updated_at or observed_at inside CST day window", () => {
    const range = cstDayRange("2026-08-20");
    expect(
      isMemoryActiveOnCstDay(
        { updated_at: new Date("2026-08-20T04:00:00.000Z"), observed_at: null },
        range,
      ),
    ).toBe(true);
    expect(
      isMemoryActiveOnCstDay(
        { updated_at: new Date("2026-08-18T04:00:00.000Z"), observed_at: null },
        range,
      ),
    ).toBe(false);
    expect(
      isMemoryActiveOnCstDay(
        {
          updated_at: new Date("2026-08-18T04:00:00.000Z"),
          observed_at: new Date("2026-08-20T12:00:00.000Z"),
        },
        range,
      ),
    ).toBe(true);
  });
});

describe("memorySortTimeMs", () => {
  it("prefers updated_at over observed_at", () => {
    expect(
      memorySortTimeMs({
        updated_at: new Date("2026-08-20T10:00:00.000Z"),
        observed_at: new Date("2026-08-20T01:00:00.000Z"),
      }),
    ).toBe(Date.parse("2026-08-20T10:00:00.000Z"));
  });
});
