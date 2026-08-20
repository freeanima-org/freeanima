import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asProject,
  asTaskItem,
  hasTaskPlan,
  planOverlapsRange,
} from "@freeanima/habitat/core/db/schema/entity";
import { searchEntities } from "@freeanima/habitat/core/db/pg/entity";
import {
  type BuiltinCalendarItem,
  type BuiltinCalendarSourceId,
  BUILTIN_CALENDAR_SOURCE_IDS,
  dedupeBuiltinItemsByDateTitle,
  filterBuiltinItemsByDateRange,
  yearsOverlappingRange,
} from "@freeanima/shared/util/builtin-calendar-sources.ts";

import { getBuiltinCalendarYear, prewarmBuiltinCalendarYears } from "./builtin-year-cache.ts";
import { expandRecurringTaskVirtuals } from "./expand-recurring-tasks.ts";
import { listCalendarEvents } from "./event-store.ts";
import type {
  CalendarRangeHolidayItem,
  CalendarRangeItem,
  CalendarRangeKind,
  CalendarRangeOpts,
  CalendarRangeTaskItem,
  CalendarStoreContext,
} from "./types.ts";
import { listCompletedActivity } from "@freeanima/features/task/domain/completed-activity.ts";

const ALL_KINDS: CalendarRangeKind[] = ["event", "task", "project", "holiday"];

function dayKeyFromIso(iso: string): string {
  return iso.slice(0, 10);
}

function sortKey(item: CalendarRangeItem): number {
  if (item.kind === "event" || item.kind === "holiday") {
    const ms = Date.parse(item.start_at);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (item.kind === "task") {
    if (
      item.status === "completed" &&
      item.completed_at &&
      !hasTaskPlan({
        start_at: item.start_at ?? null,
        end_at: item.end_at ?? null,
      })
    ) {
      const ms = Date.parse(item.completed_at);
      return Number.isFinite(ms) ? ms : 0;
    }
    const anchor = item.start_at ?? item.end_at ?? item.due_at ?? item.completed_at ?? null;
    const ms = anchor ? Date.parse(anchor) : NaN;
    return Number.isFinite(ms) ? ms : 0;
  }
  const start = item.start_at ? Date.parse(item.start_at) : NaN;
  return Number.isFinite(start) ? start : 0;
}

function taskLiveKey(id: number, occurrenceId?: number): string {
  return occurrenceId != null ? `task-occ-${occurrenceId}` : `task-live-${id}`;
}

function mergeCompletedTask(
  byKey: Map<string, CalendarRangeTaskItem>,
  next: CalendarRangeTaskItem,
): void {
  const key = taskLiveKey(next.id, next.occurrence_id);
  const prev = byKey.get(key);
  if (!prev) {
    byKey.set(key, next);
    return;
  }
  const occurrenceId = next.occurrence_id ?? prev.occurrence_id;
  const merged: CalendarRangeTaskItem = {
    kind: "task",
    id: next.id,
    title: next.title,
    status: "completed",
    priority: next.priority,
    project_id: next.project_id,
    list_id: next.list_id,
    start_at: next.start_at ?? prev.start_at ?? null,
    end_at: next.end_at ?? prev.end_at ?? null,
    due_at: next.due_at ?? prev.due_at ?? null,
    completed_at: next.completed_at ?? prev.completed_at ?? null,
    ...(occurrenceId != null ? { occurrence_id: occurrenceId } : {}),
    ...(next.virtual != null || prev.virtual != null
      ? { virtual: next.virtual ?? prev.virtual }
      : {}),
  };
  byKey.set(key, merged);
}

async function listCompletedTasksForRange(
  ctx: CalendarStoreContext,
  from: string,
  to: string,
): Promise<CalendarRangeTaskItem[]> {
  const rows = await listCompletedActivity(
    ctx.worldId,
    {
      status: "completed",
      completed_after: from,
      completed_before: to,
      roots_only: true,
    },
    { limit: 500 },
  );
  const byKey = new Map<string, CalendarRangeTaskItem>();
  for (const item of rows) {
    mergeCompletedTask(byKey, {
      kind: "task",
      id: item.id,
      title: item.title,
      start_at: item.start_at ?? null,
      end_at: item.end_at ?? null,
      due_at: item.due_at ?? null,
      status: "completed",
      priority: item.priority ?? "none",
      project_id: item.project_id ?? null,
      list_id: item.list_id ?? null,
      completed_at: item.completed_at ?? null,
      ...(item.occurrence_id != null ? { occurrence_id: item.occurrence_id } : {}),
    });
  }

  // 计划与窗相交、但 completed_at 落在窗外的已完成任务
  const planned = await searchEntities({
    world_id: ctx.worldId,
    component: TASK_ITEM_COMPONENT,
    filters: {
      status: "completed",
      roots_only: true,
    },
    limit: 500,
    mode: "filter_only",
  });
  for (const row of planned.results) {
    const item = asTaskItem(row);
    if (!item) continue;
    const startAt = item.start_at ?? null;
    const endAt = item.end_at ?? null;
    if (!hasTaskPlan({ start_at: startAt, end_at: endAt })) continue;
    if (!planOverlapsRange(startAt, endAt, from, to)) continue;
    mergeCompletedTask(byKey, {
      kind: "task",
      id: item.id,
      title: item.title,
      start_at: startAt,
      end_at: endAt,
      due_at: item.due_at ?? null,
      status: "completed",
      priority: item.priority ?? "none",
      project_id: item.project_id ?? null,
      list_id: item.list_id ?? null,
      completed_at: item.completed_at ?? null,
    });
  }

  return [...byKey.values()];
}

function itemSortId(item: CalendarRangeItem): string {
  return typeof item.id === "number" ? String(item.id) : item.id;
}

function resolveHolidaySources(
  sources: BuiltinCalendarSourceId[] | undefined,
): BuiltinCalendarSourceId[] {
  if (sources?.length) return [...new Set(sources)];
  return [...BUILTIN_CALENDAR_SOURCE_IDS];
}

async function listBuiltinHolidaysInRange(
  from: string,
  to: string,
  sources: BuiltinCalendarSourceId[],
): Promise<CalendarRangeHolidayItem[]> {
  const fromDay = dayKeyFromIso(from);
  const toDay = dayKeyFromIso(to);
  const years = yearsOverlappingRange(from, to);
  const collected: BuiltinCalendarItem[] = [];
  for (const source of sources) {
    for (const year of years) {
      collected.push(...(await getBuiltinCalendarYear(source, year)));
    }
  }
  const clipped = filterBuiltinItemsByDateRange(collected, fromDay, toDay);
  const deduped = dedupeBuiltinItemsByDateTitle(clipped);
  return deduped.map((it) => ({
    kind: "holiday" as const,
    id: it.id,
    source: it.source,
    title: it.title,
    start_at: `${it.date}T00:00:00+08:00`,
    end_at: null,
    all_day: true as const,
  }));
}

export async function listCalendarRange(
  ctx: CalendarStoreContext,
  opts: CalendarRangeOpts,
): Promise<CalendarRangeItem[]> {
  const kinds = opts.kinds?.length ? opts.kinds : ALL_KINDS;
  const kindSet = new Set(kinds);
  const items: CalendarRangeItem[] = [];

  if (kindSet.has("event")) {
    const events = await listCalendarEvents(ctx, {
      range_start: opts.from,
      range_end: opts.to,
      limit: 500,
    });
    for (const e of events) {
      items.push({
        kind: "event",
        id: e.id,
        title: e.title,
        content: e.content,
        start_at: e.start_at,
        end_at: e.end_at,
        all_day: e.all_day,
        remind_at: e.remind_at,
        ...(e.reminders != null && e.reminders.length > 0 ? { reminders: e.reminders } : {}),
      });
    }
  }

  if (kindSet.has("task")) {
    const result = await searchEntities({
      world_id: ctx.worldId,
      component: TASK_ITEM_COMPONENT,
      filters: {
        status: "pending",
        roots_only: true,
        // 不设 in_backlog：同时包含清单/backlog 与项目内带计划任务
      },
      limit: 500,
      mode: "filter_only",
    });
    for (const row of result.results) {
      const item = asTaskItem(row);
      if (!item) continue;
      const startAt = item.start_at ?? null;
      const endAt = item.end_at ?? null;
      const dueAt = item.due_at ?? null;
      if (hasTaskPlan({ start_at: startAt, end_at: endAt })) {
        if (planOverlapsRange(startAt, endAt, opts.from, opts.to)) {
          items.push({
            kind: "task",
            id: item.id,
            title: item.title,
            start_at: startAt,
            end_at: endAt,
            due_at: dueAt,
            status: item.status === "completed" ? "completed" : "pending",
            priority: item.priority ?? "none",
            project_id: item.project_id ?? null,
            list_id: item.list_id ?? null,
          });
        }
      }
      if (item.recurrence && hasTaskPlan({ start_at: startAt, end_at: endAt })) {
        items.push(
          ...expandRecurringTaskVirtuals({
            id: item.id,
            title: item.title,
            status: item.status === "completed" ? "completed" : "pending",
            priority: item.priority ?? "none",
            project_id: item.project_id ?? null,
            list_id: item.list_id ?? null,
            start_at: startAt,
            end_at: endAt,
            due_at: dueAt,
            recurrence: item.recurrence,
            from: opts.from,
            to: opts.to,
          }),
        );
      }
    }
    if (opts.include_completed) {
      items.push(...(await listCompletedTasksForRange(ctx, opts.from, opts.to)));
    }
  }

  if (kindSet.has("project")) {
    const result = await searchEntities({
      world_id: ctx.worldId,
      primary_component: PROJECT_COMPONENT,
      filters: {
        range_start: opts.from,
        range_end: opts.to,
      },
      limit: 500,
      mode: "filter_only",
    });
    for (const row of result.results) {
      const project = asProject(row);
      if (!project) continue;
      // 日程只展示活跃项目：已完成 / 搁置 / 取消不进入 range
      if (project.status !== "active") continue;
      items.push({
        kind: "project",
        id: project.id,
        title: project.title,
        start_at: project.start_at ?? null,
        end_at: project.end_at ?? null,
        status: project.status,
      });
    }
  }

  if (kindSet.has("holiday")) {
    const sources = resolveHolidaySources(opts.sources);
    items.push(...(await listBuiltinHolidaysInRange(opts.from, opts.to, sources)));
    prewarmBuiltinCalendarYears(sources);
  }

  return items.toSorted((a, b) => {
    const d = sortKey(a) - sortKey(b);
    if (d !== 0) return d;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return itemSortId(a).localeCompare(itemSortId(b));
  });
}
