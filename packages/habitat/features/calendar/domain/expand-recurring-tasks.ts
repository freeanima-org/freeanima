import { advanceScheduleAt, type TaskRecurrence } from "@freeanima/habitat/core/db/schema/entity";
import {
  shiftSchedulableDueAt,
  shiftSchedulablePlannedRange,
  taskPlanClock,
} from "@freeanima/habitat/core/db/schema/entity/components/schedulable.ts";

import type { CalendarRangeTaskItem } from "./types.ts";

const MAX_VIRTUAL = 64;

function dayKey(iso: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m?.[1] ?? iso.slice(0, 10);
}

/**
 * 在 [from,to] 内虚拟展开重复任务后续实例（不写库）。
 * 按计划时钟（end_at ?? start_at）滚期；live 当期已由 range-store 收录时跳过同日。
 */
export function expandRecurringTaskVirtuals(opts: {
  id: number;
  title: string;
  status: "pending" | "completed";
  priority: "high" | "medium" | "low" | "none";
  project_id: number | null;
  list_id: number | null;
  start_at: string | null;
  end_at: string | null;
  due_at: string | null;
  recurrence: TaskRecurrence;
  from: string;
  to: string;
}): CalendarRangeTaskItem[] {
  const planClock = taskPlanClock({ start_at: opts.start_at, end_at: opts.end_at });
  if (planClock == null) return [];

  const fromDay = dayKey(opts.from);
  const toDay = dayKey(opts.to);
  const liveDay = dayKey(planClock);
  const out: CalendarRangeTaskItem[] = [];
  let cursor = opts.recurrence.schedule_at || planClock;
  let guard = 0;
  while (guard < MAX_VIRTUAL) {
    guard += 1;
    let nextIso: string;
    try {
      nextIso = advanceScheduleAt(cursor, opts.recurrence);
    } catch {
      break;
    }
    const nextDay = dayKey(nextIso);
    if (nextDay > toDay) break;
    cursor = nextIso;
    if (nextDay < fromDay) continue;
    if (nextDay === liveDay) continue;
    const nextPlan = shiftSchedulablePlannedRange(planClock, nextIso, opts.start_at, opts.end_at);
    const nextDue = shiftSchedulableDueAt(planClock, nextIso, opts.due_at);
    out.push({
      kind: "task",
      id: opts.id,
      title: opts.title,
      start_at: nextPlan.start_at,
      end_at: nextPlan.end_at,
      due_at: nextDue,
      status: opts.status,
      priority: opts.priority,
      project_id: opts.project_id,
      list_id: opts.list_id,
      virtual: true,
    });
  }
  return out;
}
