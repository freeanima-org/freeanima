import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";

/**
 * 对话级工具策略过滤器。
 * 可见对话默认不收窄；若未来写入策略快照可在此消费。
 */
export type ConversationToolPolicyFilter = (
  toolNames: string[],
  meta: ConversationMetaMessage,
) => string[];

let sessionToolPolicyFilter: ConversationToolPolicyFilter | null = null;

/** 由 service 组合根注入 */
export function registerConversationToolPolicyFilter(filter: ConversationToolPolicyFilter): void {
  sessionToolPolicyFilter = filter;
}

export function applyConversationToolPolicyFilter(
  toolNames: string[],
  meta: ConversationMetaMessage,
): string[] {
  if (!sessionToolPolicyFilter) return toolNames;
  return sessionToolPolicyFilter(toolNames, meta);
}
