export * from "./entity.ts";
export * from "./components/index.ts";
export * from "./body.ts";
export * from "./views.ts";
export * from "./search-filters.ts";
export * from "./search-text.ts";

/** Bootstrap placeholder for subject/world row creation (not a task namespace). */
export const ENTITY_ROOT_WORLD_ID = 1;

/** @deprecated 旧 migration 种子 id；新实例按 world 懒创建默认 Inbox，勿硬编码。 */
export const ENTITY_DEFAULT_TASK_LIST_ID = 2;
