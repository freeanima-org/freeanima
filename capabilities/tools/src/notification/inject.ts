import type { NotificationRow } from "@freeanima/core/repos";
import type { AssistantMessage, StoredMessage } from "@freeanima/core/db/domain";

export const NOTIFICATION_CONTEXT_ASSISTANT_NAME = "notification_context";

export const NOTIFICATION_CONTEXT_HEAD =
  "以下是你（Agent）的未读系统通知，不是用户发言。请逐条处理后再回复用户。";

export const NOTIFICATION_HANDLING_PROTOCOL = `## Handling protocol
逐条判断是否需要动手（勿按来源类型硬编码行为）：
1. **知晓即可**：仅需了解、不必改系统或代用户操作 → 可在回复中简述 → \`notification_mark_read({ ids: [...] })\` 批量已读
2. **需处理且快速**：估计 ≤3 轮 tool 调用能完成 → 先处理 → 再 \`notification_mark_read\` 该 id
3. **需处理但耗时/不确定**：先问用户是否现在处理；未获同意 **不要** mark_read（下轮 user 消息前仍会注入）
注入块不完整时用 \`notification_list(recipient=agent, read_filter=unread)\` 补查。`;

export const NOTIFICATION_CONTEXT_FENCE = "notification";

export const NOTIFICATION_INJECT_LIMIT = 10;

export const NOTIFICATION_BODY_PREVIEW_MAX = 400;

function truncateBody(body: string, max = NOTIFICATION_BODY_PREVIEW_MAX): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

export function formatNotificationBlock(rows: NotificationRow[]): string {
  const lines = rows.map(
    (row) => `[id:${row.id}] title: ${row.title}\nbody: ${truncateBody(row.body)}`,
  );
  if (lines.length === 0) return "";
  return "```" + NOTIFICATION_CONTEXT_FENCE + "\n" + lines.join("\n\n") + "\n```";
}

export function wrapNotificationContext(rows: NotificationRow[]): string {
  const block = formatNotificationBlock(rows);
  if (!block) return "";
  return `${NOTIFICATION_CONTEXT_HEAD}\n\n${NOTIFICATION_HANDLING_PROTOCOL}\n\n## Unread notifications\n${block}`;
}

export function isNotificationContextAssistant(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant" && msg.name === NOTIFICATION_CONTEXT_ASSISTANT_NAME;
}

export function stripNotificationContextFromMessages(messages: StoredMessage[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isNotificationContextAssistant(messages[i]!)) {
      messages.splice(i, 1);
    }
  }
}

/** Manifest unread notifications as runtime-only assistant immediately before the last user message. */
export function manifestNotificationContext(
  messages: StoredMessage[],
  rows: NotificationRow[],
): void {
  const lastIdx = messages.length - 1;
  const lastMsg = messages[lastIdx];
  if (!lastMsg || lastMsg.role !== "user") return;

  const content = wrapNotificationContext(rows);
  if (!content.trim()) return;

  const manifest: AssistantMessage = {
    role: "assistant",
    name: NOTIFICATION_CONTEXT_ASSISTANT_NAME,
    content,
  };
  messages.splice(lastIdx, 0, manifest);
}
