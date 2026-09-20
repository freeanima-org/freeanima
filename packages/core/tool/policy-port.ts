import type { ConversationMetaMessage } from "@freeanima/core/db/domain";

/**
 * 对话级工具策略过滤器。
 * 可见对话默认不收窄；若未来写入策略快照可在此消费。
 */
export type ConversationToolPolicyFilter = (
  toolNames: string[],
  meta: ConversationMetaMessage,
) => string[];

let filter: ConversationToolPolicyFilter | null = null;

/** 注册过滤器（组合根 / 测试）；传 null 清除。 */
export function setConversationToolPolicyFilter(next: ConversationToolPolicyFilter | null): void {
  filter = next;
}

/** 未注册时不收窄。 */
export function applyConversationToolPolicyFilter(
  toolNames: string[],
  meta: ConversationMetaMessage,
): string[] {
  if (!filter) return toolNames;
  return filter(toolNames, meta);
}
