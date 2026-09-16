import type { ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import { getProcessContext } from "@freeanima/habitat/platform/service/process-context.ts";

/**
 * 对话级工具策略过滤器。
 * 可见对话默认不收窄；若未来写入策略快照可在此消费。
 */
export type ConversationToolPolicyFilter = (
  toolNames: string[],
  meta: ConversationMetaMessage,
) => string[];

/** 由 `ctx.toolPolicy` Cordis 服务提供；未挂载时不收窄。 */
export function applyConversationToolPolicyFilter(
  toolNames: string[],
  meta: ConversationMetaMessage,
): string[] {
  const service = getProcessContext()?.toolPolicy;
  if (!service) return toolNames;
  return service.apply(toolNames, meta);
}
