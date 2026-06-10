import type { FridgeMagnetScanHit } from "./types.ts";

/** Fridge magnet persistence port (Redis etc. injected at composition root) */
export interface FridgeStorePort {
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  get(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
  scan(pattern: string): Promise<FridgeMagnetScanHit[]>;
}

const noopStore: FridgeStorePort = {
  set: async () => {},
  get: async () => null,
  delete: async () => {},
  scan: async () => [],
};

let store: FridgeStorePort | null = null;

export function registerFridgeStore(port: FridgeStorePort): void {
  store = port;
}

export function getFridgeStore(): FridgeStorePort {
  return store ?? noopStore;
}

export function resetFridgeStoreForTests(): void {
  store = null;
}
