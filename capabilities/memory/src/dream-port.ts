import type { DreamMemoryStorePort } from "@freeanima/core/repos";

let dreamMemoryStore: DreamMemoryStorePort | null = null;

/** Injected by service at startup */
export function registerDreamMemoryStore(store: DreamMemoryStorePort): void {
  dreamMemoryStore = store;
}

export function getDreamMemoryStore(): DreamMemoryStorePort {
  if (!dreamMemoryStore) {
    throw new Error(
      "dream memory store not configured: call registerDreamMemoryStore() at service startup",
    );
  }
  return dreamMemoryStore;
}

/** Reset for tests */
export function resetDreamMemoryStoreForTests(): void {
  dreamMemoryStore = null;
}
