import { describe, expect, test } from "bun:test";

import {
  hasTaskDeadline,
  hasTaskPlan,
  normalizeSchedulableReminders,
  planOverlapsRange,
  reshapeLegacyTaskTimes,
  shiftSchedulableDueAt,
  shiftSchedulablePlannedRange,
  taskPlanClock,
} from "./schedulable.ts";

describe("taskPlanClock", () => {
  test("时段取 end，单点取 start，空串当空", () => {
    expect(taskPlanClock({ start_at: "2026-08-10T09:00:00+08:00" })).toBe(
      "2026-08-10T09:00:00+08:00",
    );
    expect(
      taskPlanClock({
        start_at: "2026-08-10T09:00:00+08:00",
        end_at: "2026-08-10T10:00:00+08:00",
      }),
    ).toBe("2026-08-10T10:00:00+08:00");
    expect(taskPlanClock({ start_at: "  ", end_at: "" })).toBeNull();
    expect(taskPlanClock({})).toBeNull();
  });

  test("hasTaskPlan / hasTaskDeadline 看非空 ISO", () => {
    expect(hasTaskPlan({ start_at: "2026-08-10T09:00:00+08:00" })).toBe(true);
    expect(hasTaskPlan({ due_at: "2026-08-10T09:00:00+08:00" } as never)).toBe(false);
    expect(hasTaskDeadline({ due_at: "2026-08-10T18:00:00+08:00" })).toBe(true);
    expect(hasTaskDeadline({ due_at: "" })).toBe(false);
  });
});

describe("reshapeLegacyTaskTimes", () => {
  test("旧 start+due 区间 → end，due 清空", () => {
    const obj: Record<string, unknown> = {
      start_at: "2026-08-10T09:00:00+08:00",
      due_at: "2026-08-10T11:00:00+08:00",
      reminders: [{ at: "2026-08-10T08:00:00+08:00" }],
    };
    expect(reshapeLegacyTaskTimes(obj)).toBe(true);
    expect(obj.end_at).toBe("2026-08-10T11:00:00+08:00");
    expect(obj.due_at).toBeNull();
    expect(obj.start_at).toBe("2026-08-10T09:00:00+08:00");
    expect((obj.reminders as { anchor?: string }[])[0]?.anchor).toBe("end");
  });

  test("旧仅 due 单点 → start，due 清空", () => {
    const obj: Record<string, unknown> = { due_at: "2026-08-10T09:00:00+08:00" };
    expect(reshapeLegacyTaskTimes(obj)).toBe(true);
    expect(obj.start_at).toBe("2026-08-10T09:00:00+08:00");
    expect(obj.end_at).toBeNull();
    expect(obj.due_at).toBeNull();
  });

  test("已有 end 不改写（due 视为真 deadline）", () => {
    const obj: Record<string, unknown> = {
      start_at: "2026-08-10T09:00:00+08:00",
      end_at: "2026-08-10T10:00:00+08:00",
      due_at: "2026-08-11T18:00:00+08:00",
    };
    expect(reshapeLegacyTaskTimes(obj)).toBe(false);
    expect(obj.due_at).toBe("2026-08-11T18:00:00+08:00");
    expect(obj.end_at).toBe("2026-08-10T10:00:00+08:00");
  });

  test("已有 reminder anchor 不覆盖", () => {
    const obj: Record<string, unknown> = {
      start_at: "2026-08-10T09:00:00+08:00",
      due_at: "2026-08-10T11:00:00+08:00",
      reminders: [{ at: "2026-08-10T08:00:00+08:00", anchor: "due" }],
    };
    reshapeLegacyTaskTimes(obj);
    expect((obj.reminders as { anchor?: string }[])[0]?.anchor).toBe("due");
  });
});

describe("normalizeSchedulableReminders", () => {
  test("数组优先、按 at 排序、镜像 remind_at", () => {
    const out = normalizeSchedulableReminders({
      remind_at: "2026-08-10T07:00:00+08:00",
      reminders: [
        { at: "2026-08-10T09:00:00+08:00", anchor: "start" },
        { at: "2026-08-10T08:00:00+08:00", anchor: "end" },
      ],
    });
    expect(out.remind_at).toBe("2026-08-10T08:00:00+08:00");
    expect(out.reminders.map((r) => r.at)).toEqual([
      "2026-08-10T08:00:00+08:00",
      "2026-08-10T09:00:00+08:00",
    ]);
  });

  test("仅 remind_at 时补一条并带 defaultAnchor", () => {
    const out = normalizeSchedulableReminders({
      remind_at: "2026-08-10T07:00:00+08:00",
      defaultAnchor: "due",
    });
    expect(out.reminders).toEqual([{ at: "2026-08-10T07:00:00+08:00", anchor: "due" }]);
  });
});

describe("shiftSchedulablePlannedRange / shiftSchedulableDueAt", () => {
  test("按计划时钟 delta 平移 start/end 与 deadline", () => {
    const planned = shiftSchedulablePlannedRange(
      "2026-08-10T10:00:00+08:00",
      "2026-08-11T10:00:00+08:00",
      "2026-08-10T09:00:00+08:00",
      "2026-08-10T10:00:00+08:00",
    );
    expect(planned.start_at).toBe("2026-08-11T09:00:00.000+08:00");
    expect(planned.end_at).toBe("2026-08-11T10:00:00.000+08:00");
    expect(
      shiftSchedulableDueAt(
        "2026-08-10T10:00:00+08:00",
        "2026-08-11T10:00:00+08:00",
        "2026-08-10T18:00:00+08:00",
      ),
    ).toBe("2026-08-11T18:00:00.000+08:00");
  });

  test("非法 ISO 保原值", () => {
    expect(shiftSchedulablePlannedRange("bad", "also-bad", "keep-start", null)).toEqual({
      start_at: "keep-start",
      end_at: null,
    });
    expect(shiftSchedulableDueAt("bad", "2026-08-11T10:00:00+08:00", "keep-due")).toBe("keep-due");
  });
});

describe("planOverlapsRange", () => {
  const from = "2026-08-10T00:00:00+08:00";
  const to = "2026-08-10T23:59:59+08:00";

  test("计划时段与窗口相交才 true", () => {
    expect(
      planOverlapsRange("2026-08-10T09:00:00+08:00", "2026-08-10T10:00:00+08:00", from, to),
    ).toBe(true);
    expect(
      planOverlapsRange("2026-08-09T09:00:00+08:00", "2026-08-09T10:00:00+08:00", from, to),
    ).toBe(false);
  });

  test("仅 deadline、无计划 → false", () => {
    expect(planOverlapsRange(null, null, from, to)).toBe(false);
  });

  test("单点计划落在窗口内", () => {
    expect(planOverlapsRange("2026-08-10T12:00:00+08:00", null, from, to)).toBe(true);
  });
});
