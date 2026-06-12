import type { AutobiographicalMemoryStorePort } from "@freeanima/storage-repos";

let autobiographicalMemoryStore: AutobiographicalMemoryStorePort | null = null;

/** Injected by service at startup */
export function registerAutobiographicalMemoryStore(store: AutobiographicalMemoryStorePort): void {
  autobiographicalMemoryStore = store;
}

export function getAutobiographicalMemoryStore(): AutobiographicalMemoryStorePort {
  if (!autobiographicalMemoryStore) {
    throw new Error(
      "autobiographical memory store not configured: call registerAutobiographicalMemoryStore() at service startup",
    );
  }
  return autobiographicalMemoryStore;
}

/** Reset for tests */
export function resetAutobiographicalMemoryStoreForTests(): void {
  autobiographicalMemoryStore = null;
}
