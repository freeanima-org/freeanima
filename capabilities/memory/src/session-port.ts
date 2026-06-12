import type { SessionStorePort } from "@freeanima/core/repos";

let memorySessionStore: SessionStorePort | null = null;

/** Injected by service at startup (avoids life ↔ connectors-db-pg direct dependency) */
export function registerMemorySessionStore(store: SessionStorePort): void {
  memorySessionStore = store;
}

export function getMemorySessionStore(): SessionStorePort {
  if (!memorySessionStore) {
    throw new Error(
      "memory SessionStore not configured: call registerMemorySessionStore() at service startup",
    );
  }
  return memorySessionStore;
}

/** Reset for tests */
export function resetMemorySessionStoreForTests(): void {
  memorySessionStore = null;
}
