import type { FridgeMagnetScanHit } from "./types.ts";

/** 冰箱贴持久化端口（组合根注入 Redis 等实现） */
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
