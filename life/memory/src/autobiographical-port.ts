import type { AutobiographicalMemoryStorePort } from "@freeanima/engine-repos";

let autobiographicalMemoryStore: AutobiographicalMemoryStorePort | null = null;

/** 由 service 启动时注入 AutobiographicalMemoryStorePort */
export function registerAutobiographicalMemoryStore(store: AutobiographicalMemoryStorePort): void {
  autobiographicalMemoryStore = store;
}

export function getAutobiographicalMemoryStore(): AutobiographicalMemoryStorePort {
  if (!autobiographicalMemoryStore) {
    throw new Error(
      "autobiographical memory store 未配置：请在服务启动时调用 registerAutobiographicalMemoryStore()",
    );
  }
  return autobiographicalMemoryStore;
}

/** 测试重置 */
export function resetAutobiographicalMemoryStoreForTests(): void {
  autobiographicalMemoryStore = null;
}
