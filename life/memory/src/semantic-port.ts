import type { SemanticMemoryStorePort } from "@freeanima/engine-repos";

let semanticMemoryStore: SemanticMemoryStorePort | null = null;

/** 由 service 启动时注入 SemanticMemoryStorePort */
export function registerSemanticMemoryStore(store: SemanticMemoryStorePort): void {
  semanticMemoryStore = store;
}

export function getSemanticMemoryStore(): SemanticMemoryStorePort {
  if (!semanticMemoryStore) {
    throw new Error(
      "semantic memory store 未配置：请在服务启动时调用 registerSemanticMemoryStore()",
    );
  }
  return semanticMemoryStore;
}

/** 测试重置 */
export function resetSemanticMemoryStoreForTests(): void {
  semanticMemoryStore = null;
}
