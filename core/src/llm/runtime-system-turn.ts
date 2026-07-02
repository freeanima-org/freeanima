import type { StoredMessage, SystemMessage } from "@freeanima/core/db/domain";

/** Runtime-only system turn injected before the latest user message (passive memory recall). */
export const PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME = "passive_memory_context";

export function isPassiveMemoryContextSystem(
  msg: StoredMessage,
): msg is SystemMessage & { name: typeof PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME } {
  return msg.role === "system" && msg.name === PASSIVE_MEMORY_CONTEXT_SYSTEM_NAME;
}

/** Named runtime system turns forwarded to the provider (non-leading). */
export function isRuntimeSystemTurn(msg: StoredMessage): msg is SystemMessage & { name: string } {
  return msg.role === "system" && typeof msg.name === "string" && msg.name.length > 0;
}
