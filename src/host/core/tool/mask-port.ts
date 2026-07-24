import type { ConversationMetaMessage } from "@freeanima/host/core/db/domain";

export type ConversationToolMaskFilter = (
  toolNames: string[],
  meta: ConversationMetaMessage,
) => string[];

let sessionToolMaskFilter: ConversationToolMaskFilter | null = null;

/** Injected by service composition root (avoids engine-conversation depending on capabilities-mask) */
export function registerConversationToolMaskFilter(filter: ConversationToolMaskFilter): void {
  sessionToolMaskFilter = filter;
}

export function applyConversationToolMaskFilter(
  toolNames: string[],
  meta: ConversationMetaMessage,
): string[] {
  if (!sessionToolMaskFilter) return toolNames;
  return sessionToolMaskFilter(toolNames, meta);
}

/** Whether capability mask preset is configured */
export function conversationHasCapabilityMask(meta: ConversationMetaMessage): boolean {
  return (meta.capability_mask?.presets.length ?? 0) > 0;
}
