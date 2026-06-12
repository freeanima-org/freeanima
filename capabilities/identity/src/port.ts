import type { SelfLayerStorePort } from "@freeanima/core/repos";

let selfLayerStore: SelfLayerStorePort | null = null;

/** Injected by service at startup */
export function registerSelfLayerStore(store: SelfLayerStorePort): void {
  selfLayerStore = store;
}

export function getSelfLayerStore(): SelfLayerStorePort {
  if (!selfLayerStore) {
    throw new Error(
      "self layer store not configured: call registerSelfLayerStore() at service startup",
    );
  }
  return selfLayerStore;
}

/** Reset for tests */
export function resetSelfLayerStoreForTests(): void {
  selfLayerStore = null;
}
