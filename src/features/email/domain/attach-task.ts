import {
  EMAIL_MESSAGE_COMPONENT,
  TASK_ITEM_COMPONENT,
  asEmailMessage,
  normalizeSchedulableReminders,
  type TaskItemBody,
} from "@freeanima/host/core/db/schema/entity";
import {
  addEntityComponent,
  assertEntityInWorld,
  deleteEntityComponent,
  getEntity,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { rescheduleTaskReminderScheduler } from "@freeanima/host/platform/boot/task-reminder-scheduler.ts";

import { ensureDefaultTaskListForWorld } from "@freeanima/features/task/domain/list-store.ts";
import { getTaskItem, listTaskItems } from "@freeanima/features/task/domain/item-store.ts";
import { nextPrependSortOrder } from "@freeanima/features/task/domain/sort-order.ts";
import type { TaskItemRow } from "@freeanima/features/task/domain/types.ts";

function touchReminderScheduler(): void {
  try {
    rescheduleTaskReminderScheduler();
  } catch {
    /* unit tests */
  }
}

export type AttachTaskToEmailInput = {
  due_at?: string | null;
  remind_at?: string | null;
  reminders?: Array<{ at: string; last_notified_at?: string | null }>;
  list_id?: number;
  title?: string;
  priority?: "high" | "medium" | "low" | "none";
};

function truncateContent(text: string, max = 4000): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** 在邮件实体上 attach task_item（primary 仍为 email_message） */
export async function attachTaskToEmailMessage(
  worldId: number,
  messageId: number,
  input: AttachTaskToEmailInput = {},
): Promise<TaskItemRow> {
  const existing = await getEntity(messageId);
  if (!existing || existing.primary_component !== EMAIL_MESSAGE_COMPONENT) {
    throw new Error("email message not found");
  }
  await assertEntityInWorld(messageId, worldId);
  if (existing.components.includes(TASK_ITEM_COMPONENT)) {
    throw new Error("task already attached to this email");
  }
  const parsed = asEmailMessage(existing);
  if (!parsed) throw new Error("email message not found");

  const dueAt = input.due_at != null && input.due_at !== "" ? input.due_at : null;
  const reminders = normalizeSchedulableReminders({
    remind_at: input.remind_at,
    reminders: input.reminders,
  });
  if (
    (dueAt == null || dueAt === "") &&
    (reminders.remind_at != null || reminders.reminders.length > 0)
  ) {
    throw new Error("reminders require due_at");
  }

  const listId = input.list_id ?? (await ensureDefaultTaskListForWorld(worldId)).id;
  const siblings = await listTaskItems(worldId, { list_id: listId, status: "pending" });
  const sort_order = nextPrependSortOrder(siblings.map((s) => s.sort_order));

  const taskBody: TaskItemBody = {
    status: "pending",
    priority: input.priority ?? "none",
    list_id: listId,
    project_id: null,
    sort_order,
    start_at: null,
    due_at: dueAt,
    remind_at: reminders.remind_at,
    reminders: reminders.reminders,
    completed_at: null,
    parent_id: null,
    client_op_id: null,
    recurrence: null,
  };

  // title 可覆盖；默认保留邮件 subject（实体 title 列）
  const titlePatch =
    input.title != null && input.title.trim() !== "" ? { title: input.title.trim() } : {};

  // content：若实体 content 空，用纯文本预览填任务备注（不强制覆盖已有 content）
  const contentPatch =
    !existing.content.trim() && (parsed.text || parsed.body)
      ? { content: truncateContent(parsed.text || parsed.body) }
      : {};

  if (Object.keys(titlePatch).length > 0 || Object.keys(contentPatch).length > 0) {
    await updateEntity({
      id: messageId,
      ...titlePatch,
      ...contentPatch,
      skip_revision: true,
    });
  }

  const row = await addEntityComponent({
    id: messageId,
    component: TASK_ITEM_COMPONENT,
    body: taskBody,
    promote_primary: false,
  });
  if (!row) throw new Error("attach task failed");
  touchReminderScheduler();
  const item = await getTaskItem(worldId, messageId);
  if (!item) throw new Error("attach task failed");
  return item;
}

/** 卸下邮件上的 task_item，保留邮件实体 */
export async function detachTaskFromEmailMessage(
  worldId: number,
  messageId: number,
): Promise<boolean> {
  const existing = await getEntity(messageId);
  if (!existing || existing.primary_component !== EMAIL_MESSAGE_COMPONENT) {
    return false;
  }
  await assertEntityInWorld(messageId, worldId);
  if (!existing.components.includes(TASK_ITEM_COMPONENT)) {
    return false;
  }
  await deleteEntityComponent(messageId, TASK_ITEM_COMPONENT);
  touchReminderScheduler();
  return true;
}

export async function emailMessageHasTask(messageId: number): Promise<boolean> {
  const existing = await getEntity(messageId);
  return Boolean(existing?.components.includes(TASK_ITEM_COMPONENT));
}
