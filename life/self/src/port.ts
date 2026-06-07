import type { SelfLayerStorePort } from "@freeanima/engine-repos";

let selfLayerStore: SelfLayerStorePort | null = null;

/** 由 service 启动时注入 SelfLayerStorePort */
export function registerSelfLayerStore(store: SelfLayerStorePort): void {
  selfLayerStore = store;
}

export function getSelfLayerStore(): SelfLayerStorePort {
  if (!selfLayerStore) {
    throw new Error("self layer store 未配置：请在服务启动时调用 registerSelfLayerStore()");
  }
  return selfLayerStore;
}

/** 测试重置 */
export function resetSelfLayerStoreForTests(): void {
  selfLayerStore = null;
}
