import type { SemanticMemoryStorePort } from "@freeanima/core/repos";

let semanticMemoryStore: SemanticMemoryStorePort | null = null;

/** Injected by service at startup */
export function registerSemanticMemoryStore(store: SemanticMemoryStorePort): void {
  semanticMemoryStore = store;
}

export function getSemanticMemoryStore(): SemanticMemoryStorePort {
  if (!semanticMemoryStore) {
    throw new Error(
      "semantic memory store not configured: call registerSemanticMemoryStore() at service startup",
    );
  }
  return semanticMemoryStore;
}

/** Reset for tests */
export function resetSemanticMemoryStoreForTests(): void {
  semanticMemoryStore = null;
}
