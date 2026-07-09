import type { ConversationPort } from "@freeanima/core/tool/conversation-port.ts";
import { isConversationMeta } from "@freeanima/core/db/domain";
import type { AcpTaskEntryJson, AcpTaskStatusJson, AcpTasksJson } from "@freeanima/core/db/schema";
import type { CursorPendingInteraction } from "./cursor-decision.ts";

export type AcpTaskEntry = AcpTaskEntryJson;
export type AcpTaskStatus = AcpTaskStatusJson;
export type AcpTasksMeta = AcpTasksJson;

export type UnhandledAcpTask = AcpTaskEntry & { acp_conversation_id: string };

const CALLBACK_STATUSES = new Set<AcpTaskStatus>(["completed", "awaiting_decision"]);

export function acpTasksNowIso(): string {
  return new Date().toISOString();
}

export async function readAcpTasks(
  conversation: ConversationPort,
  animaSessionId: string,
): Promise<AcpTasksMeta> {
  const meta = await conversation.loadConversationMeta(animaSessionId);
  if (!isConversationMeta(meta)) return {};
  const raw = meta.acp_tasks;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as AcpTasksMeta) };
}

export async function readAcpTasksHandledAt(
  conversation: ConversationPort,
  animaSessionId: string,
): Promise<string> {
  const meta = await conversation.loadConversationMeta(animaSessionId);
  if (!isConversationMeta(meta)) return "";
  return typeof meta.acp_tasks_handled_at === "string" ? meta.acp_tasks_handled_at : "";
}

export async function setAcpTasksHandledAt(
  conversation: ConversationPort,
  animaSessionId: string,
  handledAt: string,
): Promise<void> {
  await conversation.updateConversationMetaField(animaSessionId, {
    acp_tasks_handled_at: handledAt,
  });
}

export async function upsertAcpTaskEntry(
  conversation: ConversationPort,
  animaSessionId: string,
  acpSessionId: string,
  entry: AcpTaskEntry,
): Promise<void> {
  const prev = await readAcpTasks(conversation, animaSessionId);
  await conversation.updateConversationMetaField(animaSessionId, {
    acp_tasks: { ...prev, [acpSessionId]: entry },
  });
}

export async function patchAcpTaskEntry(
  conversation: ConversationPort,
  animaSessionId: string,
  acpSessionId: string,
  patch: Partial<AcpTaskEntry>,
): Promise<void> {
  const prev = await readAcpTasks(conversation, animaSessionId);
  const current = prev[acpSessionId];
  if (!current) return;
  await upsertAcpTaskEntry(conversation, animaSessionId, acpSessionId, {
    ...current,
    ...patch,
    updated_at: patch.updated_at ?? acpTasksNowIso(),
  });
}

/** Most recently updated ACP conversation for agent (e.g. new_session cleanup) */
export async function getBoundAcpSession(
  conversation: ConversationPort,
  animaSessionId: string,
  agentName: string,
): Promise<string | undefined> {
  const tasks = await readAcpTasks(conversation, animaSessionId);
  let best: { id: string; updated_at: string } | undefined;
  for (const [acpSessionId, entry] of Object.entries(tasks)) {
    if (entry.agent_name !== agentName) continue;
    if (acpSessionId.startsWith("queued:")) continue;
    if (entry.status === "cancelled" || entry.status === "error") continue;
    if (!best || entry.updated_at > best.updated_at) {
      best = { id: acpSessionId, updated_at: entry.updated_at };
    }
  }
  return best?.id;
}

export async function bindAcpTaskRunning(
  conversation: ConversationPort,
  animaSessionId: string,
  agentName: string,
  acpSessionId: string,
  taskId: string,
): Promise<void> {
  await upsertAcpTaskEntry(conversation, animaSessionId, acpSessionId, {
    status: "running",
    task_id: taskId,
    agent_name: agentName,
    updated_at: acpTasksNowIso(),
  });
}

export async function bindAcpTaskQueued(
  conversation: ConversationPort,
  animaSessionId: string,
  agentName: string,
  taskId: string,
): Promise<void> {
  const placeholderSessionId = `queued:${taskId}`;
  await upsertAcpTaskEntry(conversation, animaSessionId, placeholderSessionId, {
    status: "queued",
    task_id: taskId,
    agent_name: agentName,
    updated_at: acpTasksNowIso(),
  });
}

export async function promoteQueuedTaskToRunning(
  conversation: ConversationPort,
  animaSessionId: string,
  agentName: string,
  taskId: string,
  acpSessionId: string,
): Promise<void> {
  const tasks = await readAcpTasks(conversation, animaSessionId);
  const placeholderKey = `queued:${taskId}`;
  const next = { ...tasks };
  delete next[placeholderKey];
  next[acpSessionId] = {
    status: "running",
    task_id: taskId,
    agent_name: agentName,
    updated_at: acpTasksNowIso(),
  };
  await conversation.updateConversationMetaField(animaSessionId, { acp_tasks: next });
}

export async function updateAcpTaskStatus(
  conversation: ConversationPort,
  animaSessionId: string,
  acpSessionId: string,
  status: AcpTaskStatus,
  opts?: { pending?: CursorPendingInteraction[]; progress_message_id?: string },
): Promise<void> {
  await patchAcpTaskEntry(conversation, animaSessionId, acpSessionId, {
    status,
    pending: opts?.pending,
    progress_message_id: opts?.progress_message_id,
    updated_at: acpTasksNowIso(),
  });
}

export async function removeAcpTaskEntry(
  conversation: ConversationPort,
  animaSessionId: string,
  acpSessionId: string,
): Promise<void> {
  const prev = await readAcpTasks(conversation, animaSessionId);
  if (!(acpSessionId in prev)) return;
  const next = { ...prev };
  delete next[acpSessionId];
  await conversation.updateConversationMetaField(animaSessionId, { acp_tasks: next });
}

export function findUnhandledAcpTasks(tasks: AcpTasksMeta, handledAt: string): UnhandledAcpTask[] {
  const out: UnhandledAcpTask[] = [];
  for (const [acpSessionId, entry] of Object.entries(tasks)) {
    if (!CALLBACK_STATUSES.has(entry.status)) continue;
    if (handledAt && entry.updated_at <= handledAt) continue;
    out.push({ ...entry, acp_conversation_id: acpSessionId });
  }
  out.sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  return out;
}
