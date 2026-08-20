import { describe, expect, test } from "bun:test";

import type { CalendarRangeItem } from "./api.ts";
import {
  dueFiltersForAgenda,
  filterEndedEvents,
  isOverdueTask,
  mergeCalendarItems,
  partitionAgendaDay,
  planOverdueFiltersForAgenda,
  shouldHideEndedEvents,
} from "./agenda-items.ts";

function event(
  partial: Partial<Extract<CalendarRangeItem, { kind: "event" }>> & { id: number },
): CalendarRangeItem {
  return {
    kind: "event",
    title: "e",
    content: "",
    start_at: "2026-08-19T10:00:00+08:00",
    end_at: "2026-08-19T11:00:00+08:00",
    all_day: false,
    remind_at: null,
    ...partial,
  };
}

function task(
  partial: Partial<Extract<CalendarRangeItem, { kind: "task" }>> & { id: number },
): CalendarRangeItem {
  return {
    kind: "task",
    title: "t",
    status: "pending",
    priority: "none",
    project_id: null,
    list_id: null,
    ...partial,
  };
}

describe("agenda-items", () => {
  const today = "2026-08-19";
  const now = new Date("2026-08-19T15:00:00+08:00");

  test("dueFiltersForAgenda：今天含逾期，其它日只取当日，且含项目内", () => {
    expect(dueFiltersForAgenda("day", today, today)).toMatchObject({
      due_on_or_before_days: 0,
      in_backlog: false,
    });
    const tomorrow = dueFiltersForAgenda("day", "2026-08-20", today);
    expect(tomorrow?.due_after?.startsWith("2026-08-20T00:00:00")).toBe(true);
    expect(tomorrow?.due_on_or_before_days).toBeUndefined();
    expect(tomorrow?.in_backlog).toBe(false);
    expect(dueFiltersForAgenda("next3", today, today)).toMatchObject({
      due_on_or_before_days: 2,
      in_backlog: false,
    });
    expect(dueFiltersForAgenda("next7", today, today)).toMatchObject({
      due_on_or_before_days: 6,
      in_backlog: false,
    });
    expect(dueFiltersForAgenda("month", today, today)).toBeNull();
  });

  test("shouldHideEndedEvents 仅今天议程与近 N 天", () => {
    expect(shouldHideEndedEvents("day", today, today)).toBe(true);
    expect(shouldHideEndedEvents("day", "2026-08-18", today)).toBe(false);
    expect(shouldHideEndedEvents("next3", today, today)).toBe(true);
    expect(shouldHideEndedEvents("month", today, today)).toBe(false);
  });

  test("filterEndedEvents 隐藏今天已结束的定时事件", () => {
    const ended = event({
      id: 1,
      start_at: "2026-08-19T09:00:00+08:00",
      end_at: "2026-08-19T10:00:00+08:00",
    });
    const later = event({
      id: 2,
      start_at: "2026-08-19T18:00:00+08:00",
      end_at: "2026-08-19T19:00:00+08:00",
    });
    const allDay = event({
      id: 3,
      all_day: true,
      start_at: "2026-08-19T00:00:00+08:00",
      end_at: "2026-08-19T23:59:59+08:00",
    });
    const filtered = filterEndedEvents([ended, later, allDay], now, today);
    expect(filtered.map((i) => i.id)).toEqual([2, 3]);
  });

  test("逾期任务只出现在今天分组", () => {
    const overdue = task({ id: 10, due_at: "2026-08-17T09:00:00+08:00" });
    const dueToday = task({ id: 11, due_at: "2026-08-19T09:00:00+08:00" });
    expect(isOverdueTask(overdue, today)).toBe(true);
    const todayPart = partitionAgendaDay([overdue, dueToday], today, today);
    expect(todayPart.overdue.map((i) => i.id)).toEqual([10]);
    expect(todayPart.dayItems.map((i) => i.id)).toEqual([11]);
    const tomorrowPart = partitionAgendaDay([overdue, dueToday], "2026-08-20", today);
    expect(tomorrowPart.overdue).toEqual([]);
    expect(tomorrowPart.dayItems).toEqual([]);
  });

  test("逾期含计划结束日早于今天（无截止也可）", () => {
    const planOverdue = task({
      id: 20,
      start_at: "2026-08-17T09:00:00+08:00",
      end_at: "2026-08-17T10:00:00+08:00",
    });
    const planToday = task({
      id: 21,
      start_at: "2026-08-19T09:00:00+08:00",
    });
    const dueOverdue = task({ id: 22, due_at: "2026-08-16T09:00:00+08:00" });
    expect(isOverdueTask(planOverdue, today)).toBe(true);
    expect(isOverdueTask(planToday, today)).toBe(false);
    expect(isOverdueTask(dueOverdue, today)).toBe(true);
    const part = partitionAgendaDay([planOverdue, planToday, dueOverdue], today, today);
    expect(part.overdue.map((i) => i.id)).toEqual(expect.arrayContaining([20, 22]));
    expect(part.overdue).toHaveLength(2);
    expect(part.dayItems.map((i) => i.id)).toEqual([21]);
  });

  test("planOverdueFiltersForAgenda：仅今日议程拉取计划已结束", () => {
    const filters = planOverdueFiltersForAgenda("day", today, today);
    expect(filters).toMatchObject({
      status: "pending",
      in_backlog: false,
      roots_only: true,
    });
    expect(filters?.plan_before?.startsWith("2026-08-19T00:00:00")).toBe(true);
    expect(planOverdueFiltersForAgenda("day", "2026-08-20", today)).toBeNull();
    expect(planOverdueFiltersForAgenda("next3", today, today)?.plan_before).toBeTruthy();
    expect(planOverdueFiltersForAgenda("month", today, today)).toBeNull();
  });

  test("mergeCalendarItems 按 live 任务 id 去重", () => {
    const planned = task({
      id: 1,
      start_at: "2026-08-19T09:00:00+08:00",
      due_at: "2026-08-19T18:00:00+08:00",
    });
    const dueOnly = task({ id: 1, due_at: "2026-08-19T18:00:00+08:00" });
    const other = task({ id: 2, due_at: "2026-08-18T09:00:00+08:00" });
    const merged = mergeCalendarItems([planned], [dueOnly, other]);
    expect(merged.map((i) => i.id)).toEqual([1, 2]);
    expect(merged[0]?.start_at).toBe("2026-08-19T09:00:00+08:00");
  });
});
