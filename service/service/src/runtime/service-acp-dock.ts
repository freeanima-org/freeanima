import { isSessionMeta } from "@freeanima/storage-db/domain";
import type { AcpTaskStatusJson } from "@freeanima/storage-db/schema";
import { getServiceContext } from "../context.ts";
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
  highlight_decision: boolean;
};

const ACTIVE_STATUSES = new Set<AcpTaskStatusJson>(["running", "awaiting_decision"]);

function conv() {
  return getServiceContext().conversation;
}

function isParlorProgressId(id: string): boolean {
  return Boolean(id && !id.includes(":"));
}

export async function getSessionAcpDock(
  sessionId: string,
  platform = "",
): Promise<SessionAcpDockSnapshot> {
  if (!(await conv().sessionExists(sessionId))) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  await checkPlatform({ platform }, sessionId);

  const meta = await conv().loadSessionMeta(sessionId);
  const rawTasks =
    isSessionMeta(meta) && meta.acp_tasks && typeof meta.acp_tasks === "object"
      ? (meta.acp_tasks as Record<string, Record<string, unknown>>)
      : {};

  const tasks: AcpDockTask[] = [];
  let progressMessageId: string | undefined;
  let highlightDecision = false;

  for (const [acpSessionId, entry] of Object.entries(rawTasks)) {
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
    if (pmid && isParlorProgressId(pmid)) progressMessageId = pmid;
  }

  let progressText = "";
  if (progressMessageId) {
    progressText =
      (await conv().repos.session.getMessageContentById(sessionId, progressMessageId)) ?? "";
  }

  return {
    session_id: sessionId,
    tasks,
    progress_text: progressText,
    highlight_decision: highlightDecision,
  };
}
