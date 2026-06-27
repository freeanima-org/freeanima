export * from "./entity.ts";
export * from "./components/index.ts";
export * from "./body.ts";
export * from "./views.ts";
export * from "./search-filters.ts";
export * from "./search-text.ts";

/** Bootstrap world entity id (seeded in migration). */
export const ENTITY_ROOT_WORLD_ID = 1;

/** 默认任务清单（不可删除，可重命名；seeded in migration）。 */
export const ENTITY_DEFAULT_TASK_LIST_ID = 2;
