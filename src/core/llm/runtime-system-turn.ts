import type { AssistantMessage, StoredMessage, SystemMessage } from "@freeanima/core/db/domain";

/** Runtime-only passive recall turn (`name` field) injected before the latest user message. */
export const PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME = "passive_memory_context";

/** @deprecated 使用 PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME */
export const PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME = PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME;

export function isPassiveMemoryContextAssistant(
  msg: StoredMessage,
): msg is AssistantMessage & { name: typeof PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME } {
  return msg.role === "assistant" && msg.name === PASSIVE_MEMORY_CONTEXT_ASSISTANT_NAME;
}

/** @deprecated 使用 isPassiveMemoryContextAssistant */
export const isPassiveMemoryContextSystem = isPassiveMemoryContextAssistant;

/** Named runtime system turns forwarded to the provider (non-leading). */
export function isRuntimeSystemTurn(msg: StoredMessage): msg is SystemMessage & { name: string } {
  return msg.role === "system" && typeof msg.name === "string" && msg.name.length > 0;
}
