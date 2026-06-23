import { isSessionMeta } from "@freeanima/core/db/domain";
import type { AcpTaskStatusJson } from "@freeanima/core/db/schema";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { checkPlatform } from "./service-sessions.ts";

export type AcpDockTask = {
  acp_session_id: string;
  task_id: string;
  agent_name: string;
  status: AcpTaskStatusJson;
  progress_message_id?: string;
};

export type SessionAcpDockSnapshot = {
  session_id: string;
  tasks: AcpDockTask[];
  progress_text: string;
  task_progress: Record<string, string>;
  highlight_decision: boolean;
};

const ACTIVE_STATUSES = new Set<AcpTaskStatusJson>(["queued", "running", "awaiting_decision"]);

function isInSessionProgressId(id: string): boolean {
  return Boolean(id && !id.includes(":"));
}

export async function getSessionAcpDock(
  deps: RuntimeDeps,
  sessionId: string,
  platform = "",
): Promise<SessionAcpDockSnapshot> {
  if (!(await deps.conversation.sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform(deps, { platform }, sessionId);

  const meta = await deps.conversation.loadSessionMeta(sessionId);
  const rawTasks =
    isSessionMeta(meta) && meta.acp_tasks && typeof meta.acp_tasks === "object"
      ? (meta.acp_tasks as Record<string, Record<string, unknown>>)
      : {};

  const tasks: AcpDockTask[] = [];
  const taskProgress: Record<string, string> = {};
  let progressParts: string[] = [];
  let highlightDecision = false;

  for (const [acpSessionId, entry] of Object.entries(rawTasks)) {
    if (acpSessionId.startsWith("queued:")) {
      const status = entry.status as AcpTaskStatusJson;
      if (status !== "queued") continue;
      const taskId = typeof entry.task_id === "string" ? entry.task_id : "";
      const agentName = typeof entry.agent_name === "string" ? entry.agent_name : "cursor";
      tasks.push({
        acp_session_id: acpSessionId,
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
    tasks.push({
      acp_session_id: acpSessionId,
      task_id: taskId,
      agent_name: agentName,
      status,
      progress_message_id: pmid,
    });
    if (status === "awaiting_decision") highlightDecision = true;
    if (pmid && isInSessionProgressId(pmid) && taskId) {
      const text =
        (await deps.conversation.repos.session.getMessageContentById(sessionId, pmid)) ?? "";
      if (text.trim()) {
        taskProgress[taskId] = text;
        progressParts.push(`[${taskId}]\n${text}`);
      }
    }
  }

  const progressText = progressParts.join("\n\n---\n\n");

  return {
    session_id: sessionId,
    tasks,
    progress_text: progressText,
    task_progress: taskProgress,
    highlight_decision: highlightDecision,
  };
}
