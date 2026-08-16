import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asProject,
  asTaskItem,
} from "@freeanima/habitat/core/db/schema/entity";
import { searchEntities } from "@freeanima/habitat/core/db/pg/entity";

import { expandRecurringTaskVirtuals } from "./expand-recurring-tasks.ts";
import { listCalendarEvents } from "./event-store.ts";
import type {
  CalendarRangeItem,
  CalendarRangeKind,
  CalendarRangeOpts,
  CalendarStoreContext,
} from "./types.ts";

const ALL_KINDS: CalendarRangeKind[] = ["event", "task", "project"];

function sortKey(item: CalendarRangeItem): number {
  if (item.kind === "event") {
    const ms = Date.parse(item.start_at);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (item.kind === "task") {
    const anchor = item.start_at ?? item.due_at;
    const ms = Date.parse(anchor);
    return Number.isFinite(ms) ? ms : 0;
  }
  const start = item.start_at ? Date.parse(item.start_at) : NaN;
  return Number.isFinite(start) ? start : 0;
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
        // 不设 in_backlog：同时包含清单/backlog 与项目内带 due 任务
      },
      limit: 500,
      mode: "filter_only",
    });
    for (const row of result.results) {
      const item = asTaskItem(row);
      if (!item) continue;
      if (item.due_at) {
        const dueMs = Date.parse(item.due_at);
        const startMs = item.start_at ? Date.parse(item.start_at) : dueMs;
        const fromMs = Date.parse(opts.from);
        const toMs = Date.parse(opts.to);
        const overlaps =
          Number.isFinite(dueMs) &&
          Number.isFinite(startMs) &&
          Number.isFinite(fromMs) &&
          Number.isFinite(toMs) &&
          startMs <= toMs &&
          dueMs >= fromMs;
        if (overlaps) {
          items.push({
            kind: "task",
            id: item.id,
            title: item.title,
            start_at: item.start_at ?? null,
            due_at: item.due_at,
            status: item.status === "completed" ? "completed" : "pending",
            priority: item.priority ?? "none",
            project_id: item.project_id ?? null,
            list_id: item.list_id ?? null,
          });
        }
      }
      if (item.recurrence && item.due_at) {
        items.push(
          ...expandRecurringTaskVirtuals({
            id: item.id,
            title: item.title,
            status: item.status === "completed" ? "completed" : "pending",
            priority: item.priority ?? "none",
            project_id: item.project_id ?? null,
            list_id: item.list_id ?? null,
            due_at: item.due_at,
            recurrence: item.recurrence,
            from: opts.from,
            to: opts.to,
          }),
        );
      }
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

  return items.toSorted((a, b) => {
    const d = sortKey(a) - sortKey(b);
    if (d !== 0) return d;
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind);
    return a.id - b.id;
  });
}
