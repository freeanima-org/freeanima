import type { TaskStorePort } from "@freeanima/engine-repos";

let taskStore: TaskStorePort | null = null;

/** 由 service 启动时注入 TaskStorePort */
export function registerTaskStore(store: TaskStorePort): void {
  taskStore = store;
}

export function getTaskStore(): TaskStorePort {
  if (!taskStore) {
    throw new Error("TaskStore 未配置：请在服务启动时调用 registerTaskStore()");
  }
  return taskStore;
}

/** 测试重置 */
export function resetTaskStoreForTests(): void {
  taskStore = null;
}
