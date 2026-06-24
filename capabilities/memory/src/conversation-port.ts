import type { ConversationStorePort } from "@freeanima/core/repos";

let memorySessionStore: ConversationStorePort | null = null;

/** Injected by platform at startup (avoids capabilities ↔ db-pg direct dependency) */
export function registerMemoryConversationStore(store: ConversationStorePort): void {
  memorySessionStore = store;
}

export function getMemoryConversationStore(): ConversationStorePort {
  if (!memorySessionStore) {
    throw new Error(
      "memory ConversationStore not configured: call registerMemoryConversationStore() at service startup",
    );
  }
  return memorySessionStore;
}

/** Reset for tests */
export function resetMemoryConversationStoreForTests(): void {
  memorySessionStore = null;
}
