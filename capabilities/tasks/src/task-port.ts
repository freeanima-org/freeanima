import type { TaskStorePort } from "@freeanima/engine-repos";

let taskStore: TaskStorePort | null = null;

/** Injected by service at startup */
export function registerTaskStore(store: TaskStorePort): void {
  taskStore = store;
}

export function getTaskStore(): TaskStorePort {
  if (!taskStore) {
    throw new Error("TaskStore not configured: call registerTaskStore() at service startup");
  }
  return taskStore;
}

/** Test reset */
export function resetTaskStoreForTests(): void {
  taskStore = null;
}
