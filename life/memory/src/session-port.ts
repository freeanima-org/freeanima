import type { SessionStorePort } from "@freeanima/engine-repos";

let memorySessionStore: SessionStorePort | null = null;

/** 由 service 启动时注入 SessionStorePort（避免 life ↔ connectors-db-pg 直接依赖） */
export function registerMemorySessionStore(store: SessionStorePort): void {
  memorySessionStore = store;
}

export function getMemorySessionStore(): SessionStorePort {
  if (!memorySessionStore) {
    throw new Error("memory SessionStore 未配置：请在服务启动时调用 registerMemorySessionStore()");
  }
  return memorySessionStore;
}

/** 测试重置 */
export function resetMemorySessionStoreForTests(): void {
  memorySessionStore = null;
}
