import { describe, expect, test } from "bun:test";

import type { TaskRecurrence } from "@freeanima/habitat/core/db/schema/entity/task-recurrence.ts";

import { expandRecurringTaskVirtuals } from "./expand-recurring-tasks.ts";

function daily(scheduleAt: string): TaskRecurrence {
  return {
    freq: "daily",
    interval: 1,
    anchor: "due",
    schedule_at: scheduleAt,
    skip: "none",
    workdays_only: false,
    calendar: "gregorian",
  };
}

describe("expandRecurringTaskVirtuals", () => {
  test("日频在窗口内生成后续日，跳过 live 当天", () => {
    const rows = expandRecurringTaskVirtuals({
      id: 7,
      title: "每日",
      status: "pending",
      priority: "none",
      project_id: null,
      list_id: 1,
      start_at: "2026-08-10T09:00:00+08:00",
      end_at: null,
      due_at: null,
      recurrence: daily("2026-08-10T09:00:00+08:00"),
      from: "2026-08-10T00:00:00+08:00",
      to: "2026-08-13T23:59:59+08:00",
    });
    expect(rows.map((r) => r.start_at)).toEqual([
      "2026-08-11T09:00:00.000+08:00",
      "2026-08-12T09:00:00.000+08:00",
      "2026-08-13T09:00:00.000+08:00",
    ]);
    expect(rows.every((r) => r.virtual === true && r.id === 7)).toBe(true);
  });

  test("无计划时钟返回空", () => {
    expect(
      expandRecurringTaskVirtuals({
        id: 1,
        title: "无计划",
        status: "pending",
        priority: "none",
        project_id: null,
        list_id: null,
        start_at: null,
        end_at: null,
        due_at: "2026-08-10T18:00:00+08:00",
        recurrence: daily("2026-08-10T09:00:00+08:00"),
        from: "2026-08-10T00:00:00+08:00",
        to: "2026-08-12T00:00:00+08:00",
      }),
    ).toEqual([]);
  });

  test("坏 recurrence 不抛、返回已展开项", () => {
    const rows = expandRecurringTaskVirtuals({
      id: 2,
      title: "坏规则",
      status: "pending",
      priority: "none",
      project_id: null,
      list_id: null,
      start_at: "2026-08-10T09:00:00+08:00",
      end_at: null,
      due_at: null,
      recurrence: { ...daily("not-a-date") },
      from: "2026-08-10T00:00:00+08:00",
      to: "2026-08-20T00:00:00+08:00",
    });
    expect(rows).toEqual([]);
  });

  test("时段任务按 end 作时钟，due 同步平移", () => {
    const rows = expandRecurringTaskVirtuals({
      id: 3,
      title: "时段",
      status: "pending",
      priority: "none",
      project_id: null,
      list_id: null,
      start_at: "2026-08-10T09:00:00+08:00",
      end_at: "2026-08-10T10:00:00+08:00",
      due_at: "2026-08-10T18:00:00+08:00",
      recurrence: daily("2026-08-10T10:00:00+08:00"),
      from: "2026-08-10T00:00:00+08:00",
      to: "2026-08-11T23:59:59+08:00",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.start_at).toBe("2026-08-11T09:00:00.000+08:00");
    expect(rows[0]?.end_at).toBe("2026-08-11T10:00:00.000+08:00");
    expect(rows[0]?.due_at).toBe("2026-08-11T18:00:00.000+08:00");
  });

  test("MAX_VIRTUAL=64 截断", () => {
    const rows = expandRecurringTaskVirtuals({
      id: 4,
      title: "长窗",
      status: "pending",
      priority: "none",
      project_id: null,
      list_id: null,
      start_at: "2026-08-01T09:00:00+08:00",
      end_at: null,
      due_at: null,
      recurrence: daily("2026-08-01T09:00:00+08:00"),
      from: "2026-08-01T00:00:00+08:00",
      to: "2026-12-31T23:59:59+08:00",
    });
    expect(rows).toHaveLength(64);
    expect(rows[0]?.start_at).toBe("2026-08-02T09:00:00.000+08:00");
  });
});
