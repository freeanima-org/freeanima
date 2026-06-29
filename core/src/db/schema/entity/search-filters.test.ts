import { describe, expect, it } from "bun:test";

import { parseDiaryEntrySearchFilters, parseTaskItemSearchFilters } from "./search-filters.ts";

describe("parseTaskItemSearchFilters", () => {
  it("parseTaskItemSearchFilters accepts task_item filter shape", () => {
    const parsed = parseTaskItemSearchFilters({
      list_id: 2,
      status: "pending",
      tags: ["work"],
      due_today: true,
    });
    expect(parsed.list_id).toBe(2);
    expect(parsed.status).toBe("pending");
    expect(parsed.tags).toEqual(["work"]);
    expect(parsed.due_today).toBe(true);
  });

  it("parseTaskItemSearchFilters rejects unknown fields", () => {
    expect(() => parseTaskItemSearchFilters({ foo: "bar" })).toThrow(/invalid task_item filters/);
  });
});

describe("parseDiaryEntrySearchFilters", () => {
  it("accepts diary_entry filter shape", () => {
    const parsed = parseDiaryEntrySearchFilters({
      entry_after: "2026-06-01T00:00:00+08:00",
      entry_before: "2026-06-30T23:59:59+08:00",
      tags: ["日常"],
    });
    expect(parsed.entry_after).toBe("2026-06-01T00:00:00+08:00");
    expect(parsed.tags).toEqual(["日常"]);
  });

  it("rejects unknown fields", () => {
    expect(() => parseDiaryEntrySearchFilters({ foo: "bar" })).toThrow(
      /invalid diary_entry filters/,
    );
  });
});
