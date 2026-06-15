import { describe, expect, it } from "bun:test";
import type { AutobiographicalMemoryRow } from "@freeanima/core/repos";

import { AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS, buildAutobiographySummary } from "./run.ts";

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function makeRow(
  overrides: Partial<AutobiographicalMemoryRow> & {
    title: string;
    significance: AutobiographicalMemoryRow["significance"];
  },
): AutobiographicalMemoryRow {
  const updated = overrides.updated ?? daysAgoIso(0);
  return {
    id: "a-test-1",
    content: `${"Long narrative body ".repeat(20)}should not appear in summary`,
    period_start: null,
    period_end: null,
    source_semantic_memory: [],
    source_sessions: [],
    status: "active",
    created: updated,
    updated,
    ...overrides,
  };
}

describe("buildAutobiographySummary", () => {
  it("returns placeholder for empty input", () => {
    expect(buildAutobiographySummary([])).toBe("(No autobiography summary yet)");
  });

  it("groups entries by significance with title-only bullets", () => {
    const summary = buildAutobiographySummary([
      makeRow({ id: "a-1", title: "First turning", significance: "turning_point" }),
      makeRow({ id: "a-2", title: "Ship milestone", significance: "milestone" }),
      makeRow({ id: "a-3", title: "Recent chat", significance: "normal" }),
    ]);

    expect(summary).toBe(
      [
        `${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.turning_point}\n- First turning`,
        `${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.milestone}\n- Ship milestone`,
        `${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.normal}\n- Recent chat`,
      ].join("\n\n"),
    );
    expect(summary).not.toContain(": ");
    expect(summary).not.toContain("Long narrative body");
  });

  it("omits empty sections", () => {
    const summary = buildAutobiographySummary([
      makeRow({ id: "a-1", title: "Only turning", significance: "turning_point" }),
    ]);

    expect(summary).toBe(`${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.turning_point}\n- Only turning`);
    expect(summary).not.toContain("Milestones");
    expect(summary).not.toContain("Recent narratives");
  });

  it("drops normal entries older than 30 days", () => {
    const summary = buildAutobiographySummary([
      makeRow({
        id: "a-1",
        title: "Old normal",
        significance: "normal",
        updated: daysAgoIso(31),
      }),
      makeRow({ id: "a-2", title: "Fresh normal", significance: "normal", updated: daysAgoIso(3) }),
    ]);

    expect(summary).toBe(`${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.normal}\n- Fresh normal`);
    expect(summary).not.toContain("Old normal");
  });

  it("drops milestone entries older than 180 days but keeps turning points", () => {
    const summary = buildAutobiographySummary([
      makeRow({
        id: "a-1",
        title: "Old milestone",
        significance: "milestone",
        updated: daysAgoIso(200),
      }),
      makeRow({
        id: "a-2",
        title: "Old turning",
        significance: "turning_point",
        updated: daysAgoIso(200),
      }),
    ]);

    expect(summary).toBe(`${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.turning_point}\n- Old turning`);
    expect(summary).not.toContain("Old milestone");
  });

  it("keeps turning points beyond 180 days in the turning section", () => {
    const summary = buildAutobiographySummary([
      makeRow({
        id: "a-1",
        title: "Stale normal",
        significance: "normal",
        updated: daysAgoIso(60),
      }),
      makeRow({
        id: "a-2",
        title: "Stale milestone",
        significance: "milestone",
        updated: daysAgoIso(200),
      }),
      makeRow({
        id: "a-3",
        title: "Old turning",
        significance: "turning_point",
        updated: daysAgoIso(200),
      }),
    ]);

    expect(summary).toBe(`${AUTOBIOGRAPHY_SUMMARY_SECTION_HEADINGS.turning_point}\n- Old turning`);
    expect(summary).not.toContain("Stale normal");
    expect(summary).not.toContain("Stale milestone");
  });

  it("returns placeholder when every entry is filtered and none are turning points", () => {
    const summary = buildAutobiographySummary([
      makeRow({
        id: "a-1",
        title: "Stale normal",
        significance: "normal",
        updated: daysAgoIso(60),
      }),
      makeRow({
        id: "a-2",
        title: "Stale milestone",
        significance: "milestone",
        updated: daysAgoIso(200),
      }),
    ]);

    expect(summary).toBe("(No autobiography summary yet)");
  });
});
