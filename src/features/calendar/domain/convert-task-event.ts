import {
  CALENDAR_EVENT_COMPONENT,
  TASK_ITEM_COMPONENT,
  asCalendarEvent,
  asTaskItem,
  normalizeSchedulableReminders,
  type CalendarEventBody,
  type TaskItemBody,
} from "@freeanima/host/core/db/schema/entity";
import {
  assertEntityInWorld,
  deleteEntity,
  getEntity,
  replacePrimaryComponent,
} from "@freeanima/host/core/db/pg/entity";
import { rescheduleTaskReminderScheduler } from "@freeanima/host/platform/boot/task-reminder-scheduler.ts";

import { ensureDefaultTaskListForWorld } from "@freeanima/features/task/domain/list-store.ts";
import { deleteOccurrencesForSeries } from "@freeanima/features/task/domain/occurrence-store.ts";
import { nextPrependSortOrder } from "@freeanima/features/task/domain/sort-order.ts";
import { getTaskItem, listTaskItems } from "@freeanima/features/task/domain/item-store.ts";
import type { TaskItemRow } from "@freeanima/features/task/domain/types.ts";

import type { CalendarEventRow, CalendarStoreContext } from "./types.ts";

function touchReminderScheduler(): void {
  try {
    rescheduleTaskReminderScheduler();
  } catch {
    /* scheduler may be unset in unit tests */
  }
}

function earliestRemindAt(input: {
  remind_at?: string | null;
  reminders?: Array<{ at: string }> | null;
}): string | null {
  const normalized = normalizeSchedulableReminders({
    remind_at: input.remind_at,
    reminders: input.reminders ?? undefined,
  });
  return normalized.remind_at;
}

/** 有损：task_item body → calendar_event body（丢弃 recurrence / 归属 / 状态等） */
export function mapTaskItemBodyToCalendarEvent(task: {
  start_at?: string | null;
  due_at?: string | null;
  remind_at?: string | null;
  reminders?: Array<{ at: string }> | null;
}): CalendarEventBody {
  const due = task.due_at != null && task.due_at !== "" ? task.due_at : null;
  const start = task.start_at != null && task.start_at !== "" ? task.start_at : null;
  if (due == null && start == null) {
    throw new Error("task requires start_at or due_at to convert to event");
  }
  const start_at = start ?? due;
  if (start_at == null) {
    throw new Error("task requires start_at or due_at to convert to event");
  }
  const end_at = start != null && due != null && start !== due ? due : null;
  return {
    start_at,
    end_at,
    all_day: false,
    remind_at: earliestRemindAt(task),
    last_notified_at: null,
    client_op_id: null,
  };
}

/** 有损：calendar_event → task_item body 字段（需调用方注入 list_id / sort_order） */
export function mapCalendarEventBodyToTaskItemFields(
  event: {
    start_at: string;
    end_at?: string | null;
    remind_at?: string | null;
  },
  opts: { list_id: number; sort_order: number },
): TaskItemBody {
  const start_at = event.start_at;
  const due_at = event.end_at != null && event.end_at !== "" ? event.end_at : event.start_at;
  const reminders = normalizeSchedulableReminders({
    remind_at: event.remind_at ?? null,
  });
  return {
    status: "pending",
    priority: "none",
    list_id: opts.list_id,
    project_id: null,
    sort_order: opts.sort_order,
    start_at: start_at === due_at ? null : start_at,
    due_at,
    remind_at: reminders.remind_at,
    reminders: reminders.reminders,
    completed_at: null,
    parent_id: null,
    client_op_id: null,
    recurrence: null,
  };
}

function toEventRowFromEntity(
  row: NonNullable<Awaited<ReturnType<typeof getEntity>>>,
): CalendarEventRow {
  const parsed = asCalendarEvent(row);
  if (!parsed) throw new Error("calendar event retype failed");
  return {
    id: parsed.id,
    title: parsed.title,
    content: parsed.content,
    start_at: parsed.start_at,
    end_at: parsed.end_at ?? null,
    all_day: parsed.all_day ?? false,
    remind_at: parsed.remind_at ?? null,
    tag_ids: [...(row.tag_ids ?? [])],
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

/** 任务 → 事件（同 id retype）；仅 pending 根任务 */
export async function convertTaskItemToCalendarEvent(
  worldId: number,
  id: number,
): Promise<CalendarEventRow> {
  const existing = await getEntity(id);
  if (!existing) throw new Error("task not found");
  await assertEntityInWorld(id, worldId);
  if (existing.primary_component !== TASK_ITEM_COMPONENT) {
    throw new Error("only primary task_item can convert to event");
  }
  const parsed = asTaskItem(existing);
  if (!parsed) throw new Error("task not found");
  if (parsed.status !== "pending") throw new Error("only pending tasks can convert to event");
  if (parsed.parent_id != null) throw new Error("subtasks cannot convert to event");

  const eventBody = mapTaskItemBodyToCalendarEvent({
    start_at: parsed.start_at ?? null,
    due_at: parsed.due_at ?? null,
    remind_at: parsed.remind_at ?? null,
    reminders: parsed.reminders ?? null,
  });

  await deleteOccurrencesForSeries(worldId, id);
  const children = await listTaskItems(worldId, {
    parent_id: id,
    roots_only: false,
    in_backlog: false,
    ...(parsed.project_id != null
      ? { project_id: parsed.project_id }
      : parsed.list_id != null
        ? { list_id: parsed.list_id }
        : {}),
  });
  for (const child of children) {
    await deleteEntity(child.id);
  }

  const row = await replacePrimaryComponent({
    id,
    from: TASK_ITEM_COMPONENT,
    to: CALENDAR_EVENT_COMPONENT,
    body: eventBody,
  });
  if (!row) throw new Error("convert to event failed");
  touchReminderScheduler();
  return toEventRowFromEntity(row);
}

/** 事件 → 任务（同 id retype）；落入默认 Inbox */
export async function convertCalendarEventToTaskItem(
  ctx: CalendarStoreContext,
  id: number,
): Promise<TaskItemRow> {
  const existing = await getEntity(id);
  if (!existing || existing.primary_component !== CALENDAR_EVENT_COMPONENT) {
    throw new Error("calendar event not found");
  }
  if (existing.world_id !== ctx.worldId) throw new Error("calendar event not found");
  const parsed = asCalendarEvent(existing);
  if (!parsed) throw new Error("calendar event not found");

  const inbox = await ensureDefaultTaskListForWorld(ctx.worldId);
  const siblings = await listTaskItems(ctx.worldId, {
    list_id: inbox.id,
    status: "pending",
  });
  const sort_order = nextPrependSortOrder(siblings.map((s) => s.sort_order));
  const taskBody = mapCalendarEventBodyToTaskItemFields(
    {
      start_at: parsed.start_at,
      end_at: parsed.end_at ?? null,
      remind_at: parsed.remind_at ?? null,
    },
    {
      list_id: inbox.id,
      sort_order,
    },
  );

  const row = await replacePrimaryComponent({
    id,
    from: CALENDAR_EVENT_COMPONENT,
    to: TASK_ITEM_COMPONENT,
    body: taskBody,
  });
  if (!row) throw new Error("convert to task failed");
  touchReminderScheduler();
  const item = await getTaskItem(ctx.worldId, id);
  if (!item) throw new Error("convert to task failed");
  return item;
}
