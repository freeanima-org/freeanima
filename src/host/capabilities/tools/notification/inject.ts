import type { NotificationRow } from "@freeanima/host/core/db/schema/rows";
import type { AssistantMessage, StoredMessage } from "@freeanima/host/core/db/domain";
import { PROMPT_XML_TAGS, wrapPromptXml } from "@freeanima/host/core/hooks/prompt";

export const NOTIFICATION_CONTEXT_ASSISTANT_NAME = "notification_context";

export const NOTIFICATION_CONTEXT_HEAD =
  "以下是你（Agent）的未读系统通知，不是用户发言。请逐条处理后再回复用户。";

export const NOTIFICATION_HANDLING_PROTOCOL = `## Handling protocol
逐条判断是否需要动手（勿按来源类型硬编码行为）：
1. **知晓即可**：仅需了解、不必改系统或代用户操作 → 可在回复中简述 → \`notification_mark_read({ ids: [...] })\` 批量已读
2. **需处理且快速**：估计 ≤3 轮 tool 调用能完成 → 先处理 → 再 \`notification_mark_read\` 该 id
3. **需处理但耗时/不确定**：先问用户是否现在处理；未获同意 **不要** mark_read（下轮 user 消息前仍会注入）
4. **自我层维护建议**（title 含「自我层维护」或 source_ref=\`self-layer-proposal\`）：属第 3 类。注入预览可能截断 → 先 \`notification_list\` 拉全文 → 向用户说明建议并征询 → 同意后按正文用 \`self_update_block\` 写回对应块 → 再 mark_read；拒绝则 mark_read 且不写块。
注入块不完整时用 \`notification_list(recipient=agent, read_filter=unread)\` 补查。`;

export const NOTIFICATION_INJECT_LIMIT = 10;

/** Default preview for ordinary notifications */
export const NOTIFICATION_BODY_PREVIEW_MAX = 400;

/** Longer preview for self-layer maintenance proposals (full text may still need notification_list) */
export const SELF_LAYER_PROPOSAL_BODY_PREVIEW_MAX = 2400;

export const SELF_LAYER_PROPOSAL_SOURCE_REF = "self-layer-proposal";

function truncateBody(body: string, max = NOTIFICATION_BODY_PREVIEW_MAX): string {
  const trimmed = body.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max)}…`;
}

function previewMaxForRow(row: NotificationRow): number {
  if (row.source_ref === SELF_LAYER_PROPOSAL_SOURCE_REF) {
    return SELF_LAYER_PROPOSAL_BODY_PREVIEW_MAX;
  }
  return NOTIFICATION_BODY_PREVIEW_MAX;
}

export function formatNotificationBlock(rows: NotificationRow[]): string {
  const lines = rows.map(
    (row) =>
      `[id:${row.id}] title: ${row.title}\nbody: ${truncateBody(row.body, previewMaxForRow(row))}`,
  );
  if (lines.length === 0) return "";
  return wrapPromptXml(PROMPT_XML_TAGS.notification, lines.join("\n\n"));
}

export function wrapNotificationContext(rows: NotificationRow[]): string {
  const block = formatNotificationBlock(rows);
  if (!block) return "";
  return `${NOTIFICATION_CONTEXT_HEAD}\n\n${NOTIFICATION_HANDLING_PROTOCOL}\n\n${block}`;
}

export function isNotificationContextAssistant(msg: StoredMessage): msg is AssistantMessage {
  return msg.role === "assistant" && msg.name === NOTIFICATION_CONTEXT_ASSISTANT_NAME;
}

export function stripNotificationContextFromMessages(messages: StoredMessage[]): void {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg !== undefined && isNotificationContextAssistant(msg)) {
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
