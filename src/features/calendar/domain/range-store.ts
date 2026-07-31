import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asProject,
  asTaskItem,
} from "@freeanima/host/core/db/schema/entity";
import { searchEntities } from "@freeanima/host/core/db/pg/entity";

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
    const ms = Date.parse(item.due_at);
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
      primary_component: TASK_ITEM_COMPONENT,
      filters: {
        status: "pending",
        has_due_at: true,
        due_after: opts.from,
        due_before: opts.to,
        in_backlog: false,
      },
      limit: 500,
      mode: "filter_only",
    });
    for (const row of result.results) {
      const item = asTaskItem(row);
      if (!item?.due_at) continue;
      items.push({
        kind: "task",
        id: item.id,
        title: item.title,
        due_at: item.due_at,
        status: item.status === "completed" ? "completed" : "pending",
        project_id: item.project_id ?? null,
        list_id: item.list_id ?? null,
      });
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
