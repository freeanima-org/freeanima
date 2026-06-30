import { isConversationMeta } from "@freeanima/core/db/domain";
import type { AcpTaskStatusJson } from "@freeanima/core/db/schema";
import { getMessageContentsByIds } from "@freeanima/core/db/pg/conversation";
import { omitUndefined } from "@freeanima/core/util";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { checkPlatform } from "./service-conversations.ts";

export type AcpDockTask = {
  acp_conversation_id: string;
  task_id: string;
  agent_name: string;
  status: AcpTaskStatusJson;
  progress_message_id?: string;
};

export type ConversationAcpDockSnapshot = {
  conversation_id: string;
  tasks: AcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};

const ACTIVE_STATUSES = new Set<AcpTaskStatusJson>(["queued", "running", "awaiting_decision"]);

function isInSessionProgressId(id: string): boolean {
  return Boolean(id && !id.includes(":"));
}

export async function getConversationAcpDock(
  deps: RuntimeDeps,
  conversationId: string,
  platform = "",
): Promise<ConversationAcpDockSnapshot> {
  if (!(await deps.conversation.conversationExists(conversationId))) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  await checkPlatform(deps, { platform }, conversationId);

  const meta = await deps.conversation.loadConversationMeta(conversationId);
  const rawTasks =
    isConversationMeta(meta) && meta.acp_tasks && typeof meta.acp_tasks === "object"
      ? (meta.acp_tasks as Record<string, Record<string, unknown>>)
      : {};

  const tasks: AcpDockTask[] = [];
  const taskProgress: Record<string, string> = {};
  let progressParts: string[] = [];
  let highlightDecision = false;
  const progressMessageIds: string[] = [];

  for (const [acpSessionId, entry] of Object.entries(rawTasks)) {
    if (acpSessionId.startsWith("queued:")) {
      const status = entry.status as AcpTaskStatusJson;
      if (status !== "queued") continue;
      const taskId = typeof entry.task_id === "string" ? entry.task_id : "";
      const agentName = typeof entry.agent_name === "string" ? entry.agent_name : "cursor";
      tasks.push({
        acp_conversation_id: acpSessionId,
        task_id: taskId,
        agent_name: agentName,
        status,
      });
      continue;
    }
    const status = entry.status as AcpTaskStatusJson;
    if (!ACTIVE_STATUSES.has(status)) continue;
    const taskId = typeof entry.task_id === "string" ? entry.task_id : "";
    const agentName = typeof entry.agent_name === "string" ? entry.agent_name : "cursor";
    const pmid =
      typeof entry.progress_message_id === "string" ? entry.progress_message_id : undefined;
    tasks.push(
      omitUndefined({
        acp_conversation_id: acpSessionId,
        task_id: taskId,
        agent_name: agentName,
        status,
        progress_message_id: pmid,
      }),
    );
    if (status === "awaiting_decision") highlightDecision = true;
    if (pmid && isInSessionProgressId(pmid) && taskId) {
      progressMessageIds.push(pmid);
    }
  }

  const contentById =
    progressMessageIds.length > 0
      ? await getMessageContentsByIds(conversationId, progressMessageIds)
      : {};

  for (const task of tasks) {
    const pmid = task.progress_message_id;
    const taskId = task.task_id;
    if (!pmid || !isInSessionProgressId(pmid) || !taskId) continue;
    const text = contentById[pmid] ?? "";
    if (text.trim()) {
      taskProgress[taskId] = text;
      progressParts.push(`[${taskId}]\n${text}`);
    }
  }

  const progressText = progressParts.join("\n\n---\n\n");

  return {
    conversation_id: conversationId,
    tasks,
    progress_text: progressText,
    task_progress: taskProgress,
    highlight_decision: highlightDecision,
  };
}
