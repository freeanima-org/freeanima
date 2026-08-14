import { describe, expect, it } from "bun:test";

import type { DiaryEntryRow } from "../lib/format-diary.ts";
import { findEntryByDayLocal, groupEntriesByDate } from "./EntryTimeline.tsx";

function entry(
  partial: Pick<DiaryEntryRow, "id" | "entry_at"> & Partial<DiaryEntryRow>,
): DiaryEntryRow {
  return {
    title: partial.title ?? partial.entry_at.slice(0, 10),
    summary: "",
    tag_ids: [],
    blocks: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("groupEntriesByDate", () => {
  it("同一天只保留 id 更大的一条", () => {
    const groups = groupEntriesByDate([
      entry({ id: 1, entry_at: "2026-03-01T12:00:00+08:00" }),
      entry({ id: 3, entry_at: "2026-03-01T18:00:00+08:00" }),
      entry({ id: 2, entry_at: "2026-03-01T09:00:00+08:00" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.item.id).toBe(3);
  });

  it("按 entry_at 降序排列多天", () => {
    const groups = groupEntriesByDate([
      entry({ id: 1, entry_at: "2026-03-01T12:00:00+08:00" }),
      entry({ id: 2, entry_at: "2026-03-03T12:00:00+08:00" }),
      entry({ id: 3, entry_at: "2026-03-02T12:00:00+08:00" }),
    ]);
    expect(groups.map((g) => g.item.id)).toEqual([2, 3, 1]);
  });
});

describe("findEntryByDayLocal", () => {
  it("按本地日查找条目", () => {
    const items = [
      entry({ id: 1, entry_at: "2026-03-01T12:00:00+08:00" }),
      entry({ id: 2, entry_at: "2026-03-02T12:00:00+08:00" }),
    ];
    expect(findEntryByDayLocal(items, "2026-03-02")?.id).toBe(2);
    expect(findEntryByDayLocal(items, "2026-03-09")).toBeUndefined();
  });
});
