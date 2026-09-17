import { describe, expect, test } from "bun:test";

import type { CalendarRangeItem } from "./api.ts";
import {
  clipRangeToDays,
  countByDay,
  dayOverflowCount,
  itemDayRange,
  kindBarClass,
  packBarsForWeek,
} from "./event-bars.ts";

function event(
  partial: Pick<Extract<CalendarRangeItem, { kind: "event" }>, "id" | "start_at" | "end_at"> & {
    title?: string;
  },
): Extract<CalendarRangeItem, { kind: "event" }> {
  return {
    kind: "event",
    id: partial.id,
    title: partial.title ?? "e",
    content: "",
    start_at: partial.start_at,
    end_at: partial.end_at,
    all_day: true,
    remind_at: null,
  };
}

function task(
  partial: Pick<Extract<CalendarRangeItem, { kind: "task" }>, "id"> & {
    start_at?: string | null;
    end_at?: string | null;
    due_at?: string | null;
    virtual?: boolean;
  },
): Extract<CalendarRangeItem, { kind: "task" }> {
  return {
    kind: "task",
    id: partial.id,
    title: "t",
    start_at: partial.start_at ?? null,
    end_at: partial.end_at ?? null,
    due_at: partial.due_at ?? null,
    status: "pending",
    priority: "none",
    project_id: null,
    list_id: 1,
    ...(partial.virtual !== undefined ? { virtual: partial.virtual } : {}),
  };
}

function project(
  partial: Pick<Extract<CalendarRangeItem, { kind: "project" }>, "id" | "start_at" | "end_at">,
): Extract<CalendarRangeItem, { kind: "project" }> {
  return {
    kind: "project",
    id: partial.id,
    title: "p",
    start_at: partial.start_at,
    end_at: partial.end_at,
    status: "active",
  };
}

const week = [
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
] as const;

describe("itemDayRange", () => {
  test("event 空 end_at 视为单日", () => {
    expect(
      itemDayRange(event({ id: 1, start_at: "2026-08-12T10:00:00+08:00", end_at: null })),
    ).toEqual({ start: "2026-08-12", end: "2026-08-12" });
  });

  test("event 跨日闭区间", () => {
    expect(
      itemDayRange(
        event({
          id: 1,
          start_at: "2026-08-12T10:00:00+08:00",
          end_at: "2026-08-14T18:00:00+08:00",
        }),
      ),
    ).toEqual({ start: "2026-08-12", end: "2026-08-14" });
  });

  test("task 用 start_at..end_at（due 不当地平终点）", () => {
    expect(
      itemDayRange(
        task({
          id: 2,
          start_at: "2026-08-11T09:00:00+08:00",
          end_at: "2026-08-13T09:00:00+08:00",
          due_at: "2026-08-20T09:00:00+08:00",
        }),
      ),
    ).toEqual({ start: "2026-08-11", end: "2026-08-13" });
  });

  test("task 仅 start 为单日；无计划不展示", () => {
    expect(
      itemDayRange(
        task({
          id: 2,
          start_at: "2026-08-12T09:00:00+08:00",
          end_at: null,
          due_at: "2026-08-20T09:00:00+08:00",
        }),
      ),
    ).toEqual({ start: "2026-08-12", end: "2026-08-12" });
    expect(
      itemDayRange(
        task({
          id: 3,
          start_at: null,
          end_at: null,
          due_at: "2026-08-12T09:00:00+08:00",
        }),
      ),
    ).toBeNull();
  });

  test("project 跨日", () => {
    expect(
      itemDayRange(
        project({
          id: 3,
          start_at: "2026-08-10T00:00:00+08:00",
          end_at: "2026-08-16T00:00:00+08:00",
        }),
      ),
    ).toEqual({ start: "2026-08-10", end: "2026-08-16" });
  });
});

describe("clipRangeToDays", () => {
  test("整周贯穿", () => {
    expect(clipRangeToDays({ start: "2026-08-01", end: "2026-08-31" }, week)).toEqual({
      colStart: 0,
      colSpan: 7,
    });
  });

  test("与周部分相交", () => {
    expect(clipRangeToDays({ start: "2026-08-13", end: "2026-08-20" }, week)).toEqual({
      colStart: 3,
      colSpan: 4,
    });
  });

  test("padding 空格跳过", () => {
    const padded = [
      null,
      null,
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ];
    expect(clipRangeToDays({ start: "2026-08-01", end: "2026-08-02" }, padded)).toEqual({
      colStart: 2,
      colSpan: 2,
    });
  });

  test("无交集返回 null", () => {
    expect(clipRangeToDays({ start: "2026-07-01", end: "2026-07-31" }, week)).toBeNull();
  });
});

describe("packBarsForWeek", () => {
  test("跨日事件占多列", () => {
    const bars = packBarsForWeek(
      [
        event({
          id: 1,
          start_at: "2026-08-12T00:00:00+08:00",
          end_at: "2026-08-14T00:00:00+08:00",
        }),
      ],
      week,
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ colStart: 2, colSpan: 3, lane: 0 });
  });

  test("同日重叠分配不同 lane", () => {
    const bars = packBarsForWeek(
      [
        event({
          id: 1,
          start_at: "2026-08-12T00:00:00+08:00",
          end_at: "2026-08-14T00:00:00+08:00",
        }),
        event({
          id: 2,
          start_at: "2026-08-13T00:00:00+08:00",
          end_at: "2026-08-13T00:00:00+08:00",
        }),
      ],
      week,
    );
    expect(bars).toHaveLength(2);
    const byId = Object.fromEntries(bars.map((b) => [b.item.id, b]));
    expect(byId[1]?.lane).toBe(0);
    expect(byId[2]?.lane).toBe(1);
  });

  test("不重叠可同 lane", () => {
    const bars = packBarsForWeek(
      [
        event({
          id: 1,
          start_at: "2026-08-10T00:00:00+08:00",
          end_at: "2026-08-11T00:00:00+08:00",
        }),
        event({
          id: 2,
          start_at: "2026-08-13T00:00:00+08:00",
          end_at: "2026-08-14T00:00:00+08:00",
        }),
      ],
      week,
    );
    expect(bars.every((b) => b.lane === 0)).toBe(true);
  });
});

describe("countByDay / overflow / kindBarClass", () => {
  test("跨日计入每一天", () => {
    const map = countByDay([
      event({
        id: 1,
        start_at: "2026-08-12T00:00:00+08:00",
        end_at: "2026-08-14T00:00:00+08:00",
      }),
    ]);
    expect(map.get("2026-08-12")).toBe(1);
    expect(map.get("2026-08-13")).toBe(1);
    expect(map.get("2026-08-14")).toBe(1);
    expect(map.get("2026-08-15")).toBeUndefined();
  });

  test("dayOverflowCount 统计超 lane 隐藏数", () => {
    const items = [1, 2, 3, 4].map((id) =>
      event({
        id,
        start_at: "2026-08-12T00:00:00+08:00",
        end_at: "2026-08-12T00:00:00+08:00",
      }),
    );
    const packed = packBarsForWeek(items, week);
    expect(dayOverflowCount(packed, 2, 3)).toBe(1);
    expect(dayOverflowCount(packed, 3, 3)).toBe(0);
  });

  test("kindBarClass 区分三类", () => {
    expect(kindBarClass("event")).toContain("primary");
    expect(kindBarClass("task")).toContain("amber");
    expect(kindBarClass("project")).toContain("sky");
    expect(kindBarClass("task", { virtual: true })).toContain("italic");
  });
});
