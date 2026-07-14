import type { AcpPromptResult, AcpTaskQueryPort } from "@freeanima/capabilities/acp";
import { getMessageContentById, listRecentMessages } from "@freeanima/core/db/pg/conversation";

const ACP_RESULT_PREFIX = "[ACP result]";
/** ACP result 通常在会话尾部，无需整会话加载 */
const ACP_RESULT_SCAN_LIMIT = 50;

function parseAcpResultMessage(content: string, taskId: string): AcpPromptResult | null {
  if (!content.startsWith(ACP_RESULT_PREFIX)) return null;
  try {
    const json = JSON.parse(content.slice(ACP_RESULT_PREFIX.length).trim()) as Record<
      string,
      unknown
    >;
    if (json.task_id !== taskId) return null;
    return {
      conversation_id: typeof json.acp_conversation_id === "string" ? json.acp_conversation_id : "",
      output: typeof json.output === "string" ? json.output : "",
      ...(Array.isArray(json.pending)
        ? { pending: json.pending as NonNullable<AcpPromptResult["pending"]> }
        : {}),
      new_session: false,
      reused_binding: false,
      explicit_session: false,
      mode:
        json.mode === "plan" || json.mode === "ask" || json.mode === "agent" ? json.mode : "agent",
    };
  } catch {
    return null;
  }
}

export function createAcpTaskQueryPort(): AcpTaskQueryPort {
  return {
    async getMessageContent(animaSessionId, messageId) {
      return getMessageContentById(animaSessionId, messageId);
    },
    async findAcpResultForTask(animaSessionId, taskId) {
      const messages = await listRecentMessages(animaSessionId, ACP_RESULT_SCAN_LIMIT);
      for (const msg of messages) {
        if (!msg || msg.role !== "assistant") continue;
        const content = typeof msg.content === "string" ? msg.content : "";
        const parsed = parseAcpResultMessage(content, taskId);
        if (parsed) return parsed;
      }
      return null;
    },
  };
}
