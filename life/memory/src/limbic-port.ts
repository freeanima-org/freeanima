import type { LimbicMemoryStorePort } from "@freeanima/engine-repos";

let limbicMemoryStore: LimbicMemoryStorePort | null = null;

/** Injected by service at startup */
export function registerLimbicMemoryStore(store: LimbicMemoryStorePort): void {
  limbicMemoryStore = store;
}

export function getLimbicMemoryStore(): LimbicMemoryStorePort {
  if (!limbicMemoryStore) {
    throw new Error(
      "limbic memory store not configured: call registerLimbicMemoryStore() at service startup",
    );
  }
  return limbicMemoryStore;
}

/** Reset for tests */
export function resetLimbicMemoryStoreForTests(): void {
  limbicMemoryStore = null;
}
