import type { ConversationPort } from "@freeanima/core/tool/conversation-port";
import { omitUndefined } from "@freeanima/core/util";
import type { AcpTaskStatus } from "./acp-tasks.ts";
import { readAcpTasks, type AcpTaskEntry, type AcpTasksMeta } from "./acp-tasks.ts";
import {
  formatElapsed,
  formatProgressBody,
  mergeProgressFragments,
  type AcpAsyncTask,
  type AcpAsyncTaskStore,
} from "./async-task.ts";
import type { AcpTaskQueryPort } from "./ports/task-query.ts";
import type { AcpPromptResult } from "./prompt-result.ts";

export type AcpTaskStatusViewStatus =
  | "queued"
  | "running"
  | "awaiting_decision"
  | "completed"
  | "failed";

export type AcpTaskStatusView = {
  task_id: string;
  acp_conversation_id: string;
  agent_name: string;
  status: AcpTaskStatusViewStatus;
  progress_text: string;
  elapsed?: string;
  queue_position?: number;
  result?: Pick<AcpPromptResult, "output" | "pending">;
  pending?: AcpTaskEntry["pending"];
};

export function normalizeAcpTaskViewStatus(
  status: AcpTaskStatus | AcpAsyncTask["status"],
): AcpTaskStatusViewStatus {
  if (status === "queued") return "queued";
  if (status === "running") return "running";
  if (status === "awaiting_decision") return "awaiting_decision";
  if (status === "completed") return "completed";
  return "failed";
}

export function findAcpTaskByTaskId(
  tasks: AcpTasksMeta,
  taskId: string,
): { acpSessionId: string; entry: AcpTaskEntry } | undefined {
  for (const [acpSessionId, entry] of Object.entries(tasks)) {
    if (entry.task_id === taskId) return { acpSessionId, entry };
  }
  return undefined;
}

export function findLatestAcpTaskEntry(
  tasks: AcpTasksMeta,
): { acpSessionId: string; entry: AcpTaskEntry } | undefined {
  let best: { acpSessionId: string; entry: AcpTaskEntry } | undefined;
  for (const [acpSessionId, entry] of Object.entries(tasks)) {
    if (!best || entry.updated_at > best.entry.updated_at) {
      best = { acpSessionId, entry };
    }
  }
  return best;
}

function findMemoryTask(
  taskStore: AcpAsyncTaskStore,
  animaSessionId: string,
  taskId?: string,
): AcpAsyncTask | undefined {
  if (taskId) {
    const task = taskStore.get(taskId);
    if (task && task.animaSessionId === animaSessionId) return task;
    return undefined;
  }
  let latest: AcpAsyncTask | undefined;
  for (const task of taskStore.listAll()) {
    if (task.animaSessionId !== animaSessionId) continue;
    if (!latest || task.startedAt > latest.startedAt) latest = task;
  }
  return latest;
}

function progressTextFromMemory(task: AcpAsyncTask): string {
  const merged = mergeProgressFragments(task.progressNotes);
  if (merged.trim()) return merged;
  return formatProgressBody(task);
}

async function progressTextFromMeta(
  query: AcpTaskQueryPort | null,
  animaSessionId: string,
  entry: AcpTaskEntry,
): Promise<string> {
  const messageId = entry.progress_message_id?.trim();
  if (!messageId || !query) return "";
  return (await query.getMessageContent(animaSessionId, messageId)) ?? "";
}

async function resolveResult(
  memoryTask: AcpAsyncTask | undefined,
  query: AcpTaskQueryPort | null,
  animaSessionId: string,
  taskId: string,
  entry?: AcpTaskEntry,
): Promise<Pick<AcpPromptResult, "output" | "pending"> | undefined> {
  if (memoryTask?.result) {
    return omitUndefined({
      output: memoryTask.result.output,
      pending: memoryTask.result.pending,
    });
  }
  if (query) {
    const parsed = await query.findAcpResultForTask(animaSessionId, taskId);
    if (parsed) {
      return omitUndefined({ output: parsed.output, pending: parsed.pending });
    }
  }
  if (entry?.pending?.length) {
    return { output: "", pending: entry.pending.map((p) => omitUndefined(p)) };
  }
  return undefined;
}

export async function queryAcpTaskStatus(opts: {
  conversation: ConversationPort;
  taskStore: AcpAsyncTaskStore;
  taskQuery?: AcpTaskQueryPort | null;
  animaSessionId: string;
  taskId?: string;
}): Promise<AcpTaskStatusView | null> {
  const taskId = opts.taskId?.trim() || undefined;
  const meta = await readAcpTasks(opts.conversation, opts.animaSessionId);
  const memoryTask = findMemoryTask(opts.taskStore, opts.animaSessionId, taskId);

  let acpSessionId: string;
  let entry: AcpTaskEntry | undefined;

  if (taskId) {
    const fromMeta = findAcpTaskByTaskId(meta, taskId);
    if (memoryTask) {
      acpSessionId = memoryTask.acpSessionId;
      entry = fromMeta?.entry;
    } else if (fromMeta) {
      acpSessionId = fromMeta.acpSessionId;
      entry = fromMeta.entry;
    } else {
      return null;
    }
  } else {
    if (memoryTask) {
      acpSessionId = memoryTask.acpSessionId;
      entry = findAcpTaskByTaskId(meta, memoryTask.taskId)?.entry;
    } else {
      const latest = findLatestAcpTaskEntry(meta);
      if (!latest) return null;
      acpSessionId = latest.acpSessionId;
      entry = latest.entry;
    }
  }

  const resolvedTaskId = memoryTask?.taskId ?? entry?.task_id ?? taskId ?? "";
  if (!resolvedTaskId) return null;

  const rawStatus = memoryTask?.status ?? entry?.status ?? "error";
  const viewStatus =
    entry?.status === "awaiting_decision"
      ? "awaiting_decision"
      : entry?.status
        ? normalizeAcpTaskViewStatus(entry.status)
        : normalizeAcpTaskViewStatus(rawStatus);

  const progressText = memoryTask
    ? progressTextFromMemory(memoryTask)
    : entry
      ? await progressTextFromMeta(opts.taskQuery ?? null, opts.animaSessionId, entry)
      : "";

  const startedAt = memoryTask?.startedAt;
  const result = await resolveResult(
    memoryTask,
    opts.taskQuery ?? null,
    opts.animaSessionId,
    resolvedTaskId,
    entry,
  );

  return {
    task_id: resolvedTaskId,
    acp_conversation_id: acpSessionId.startsWith("queued:") ? "" : acpSessionId,
    agent_name: memoryTask?.agentName ?? entry?.agent_name ?? "cursor",
    status: viewStatus,
    progress_text: progressText,
    ...(memoryTask?.queuePosition ? { queue_position: memoryTask.queuePosition } : {}),
    ...(startedAt ? { elapsed: formatElapsed(Date.now() - startedAt) } : {}),
    ...(result ? { result } : {}),
    ...(entry?.pending?.length ? { pending: entry.pending } : {}),
  };
}

function acpTaskStatusSortOrder(s: AcpTaskStatusViewStatus): number {
  return s === "awaiting_decision" ? 0 : s === "running" ? 1 : s === "queued" ? 2 : 3;
}

export async function queryAcpTaskStatusList(opts: {
  conversation: ConversationPort;
  taskStore: AcpAsyncTaskStore;
  taskQuery?: AcpTaskQueryPort | null;
  animaSessionId: string;
}): Promise<AcpTaskStatusView[]> {
  const meta = await readAcpTasks(opts.conversation, opts.animaSessionId);
  const taskIds = new Set<string>();

  for (const entry of Object.values(meta)) {
    if (entry.task_id) taskIds.add(entry.task_id);
  }
  for (const task of opts.taskStore.listAll()) {
    if (task.animaSessionId === opts.animaSessionId) taskIds.add(task.taskId);
  }

  const views: AcpTaskStatusView[] = [];
  for (const id of taskIds) {
    const view = await queryAcpTaskStatus({ ...opts, taskId: id });
    if (view) views.push(view);
  }
  views.sort(
    (a, b) =>
      acpTaskStatusSortOrder(a.status) - acpTaskStatusSortOrder(b.status) ||
      a.task_id.localeCompare(b.task_id),
  );
  return views;
}
