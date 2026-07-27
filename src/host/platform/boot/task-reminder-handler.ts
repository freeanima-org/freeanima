import { TASK_ITEM_COMPONENT, asTaskItem } from "@freeanima/host/core/db/schema/entity";
import { getResolvedWorldContext } from "@freeanima/host/core/config";
import { searchEntities, updateEntity } from "@freeanima/host/core/db/pg/entity";
import { formatCstIso } from "@freeanima/host/core/util";
import { getNotificationPort } from "@freeanima/host/capabilities/tools/notification";
import type { NotificationRecipientRef } from "@freeanima/host/capabilities/tools/notification";

export type TaskReminderSchedulable = {
  due_at?: string | null;
  remind_at?: string | null;
  last_notified_at?: string | null;
};

function taskReminderFields(item: {
  title: string;
  due_at?: string | null | undefined;
  remind_at?: string | null | undefined;
  last_notified_at?: string | null | undefined;
}): TaskReminderSchedulable & { title: string } {
  return {
    title: item.title,
    ...(item.due_at !== undefined ? { due_at: item.due_at } : {}),
    ...(item.remind_at !== undefined ? { remind_at: item.remind_at } : {}),
    ...(item.last_notified_at !== undefined ? { last_notified_at: item.last_notified_at } : {}),
  };
}

/** remind_at 优先；无 remind_at 时用 due_at */
export function triggerMs(item: TaskReminderSchedulable): number | null {
  const remind = item.remind_at ? Date.parse(item.remind_at) : NaN;
  if (Number.isFinite(remind)) return remind;
  const due = item.due_at ? Date.parse(item.due_at) : NaN;
  return Number.isFinite(due) ? due : null;
}

export function shouldSendTaskReminder(
  item: TaskReminderSchedulable,
  nowMs: number = Date.now(),
): boolean {
  const at = triggerMs(item);
  if (at == null || at > nowMs) return false;
  const lastNotified = item.last_notified_at ? Date.parse(item.last_notified_at) : NaN;
  if (Number.isFinite(lastNotified) && lastNotified >= at) return false;
  return true;
}

export function taskReminderSourceRef(taskItemId: number, triggerAtMs: number): string {
  return `task_item:${taskItemId}:trigger:${new Date(triggerAtMs).toISOString()}`;
}

function buildReminderBody(item: TaskReminderSchedulable & { title: string }): string {
  const dueLine = item.due_at ? `截止时间：${item.due_at}` : "";
  const remindLine = item.remind_at ? `提醒时间：${item.remind_at}` : "";
  return [dueLine, remindLine].filter(Boolean).join("\n") || item.title;
}

/** 将 task 所属 world 映射到通知收件人；未知 world 返回 null */
export function recipientForTaskWorld(
  worldId: number,
  port: {
    getUserRecipient(): NotificationRecipientRef;
    getAgentRecipient(): NotificationRecipientRef;
  },
): NotificationRecipientRef | null {
  const ctx = getResolvedWorldContext();
  if (worldId === ctx.user_world_id) return port.getUserRecipient();
  if (worldId === ctx.agent_world_id) return port.getAgentRecipient();
  return null;
}

/** 全表扫描到期/提醒已到的 pending 任务，按 entity world 写对应 subject Inbox */
export async function runTaskReminderScan(): Promise<string> {
  const port = getNotificationPort();
  if (!port) {
    return JSON.stringify({ ok: false, error: "notification port unavailable" });
  }

  const now = Date.now();
  const ctx = getResolvedWorldContext();
  const search = await searchEntities({
    primary_component: TASK_ITEM_COMPONENT,
    filters: { status: "pending" },
    limit: 500,
    mode: "filter_only",
    global: true,
    accessible_world_ids: [ctx.user_world_id, ctx.agent_world_id],
  });

  let sent = 0;
  let skippedUnknownWorld = 0;
  for (const row of search.results) {
    const item = asTaskItem(row);
    if (!item || item.status === "completed") continue;
    const schedulable = taskReminderFields(item);
    if (!shouldSendTaskReminder(schedulable, now)) continue;

    const at = triggerMs(schedulable);
    if (at == null) continue;

    const recipient = recipientForTaskWorld(row.world_id, port);
    if (!recipient) {
      skippedUnknownWorld += 1;
      continue;
    }

    const body = buildReminderBody(schedulable);
    const sourceRef = taskReminderSourceRef(item.id, at);

    await port.create({
      recipient_kind: recipient.kind,
      recipient_id: recipient.id,
      title: `任务到期：${item.title}`,
      body,
      source_kind: "system",
      source_ref: sourceRef,
      payload: { task_item_id: item.id },
    });

    await updateEntity({
      id: item.id,
      body: { last_notified_at: formatCstIso(new Date()) },
    });
    sent += 1;
  }

  return JSON.stringify({
    ok: true,
    sent,
    scanned: search.results.length,
    skipped_unknown_world: skippedUnknownWorld,
  });
}
