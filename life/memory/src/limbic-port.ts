import type { LimbicMemoryStorePort } from "@freeanima/engine-repos";

let limbicMemoryStore: LimbicMemoryStorePort | null = null;

/** 由 service 启动时注入 LimbicMemoryStorePort */
export function registerLimbicMemoryStore(store: LimbicMemoryStorePort): void {
  limbicMemoryStore = store;
}

export function getLimbicMemoryStore(): LimbicMemoryStorePort {
  if (!limbicMemoryStore) {
    throw new Error("limbic memory store 未配置：请在服务启动时调用 registerLimbicMemoryStore()");
  }
  return limbicMemoryStore;
}

/** 测试重置 */
export function resetLimbicMemoryStoreForTests(): void {
  limbicMemoryStore = null;
}
