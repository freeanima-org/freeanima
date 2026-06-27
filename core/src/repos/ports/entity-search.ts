import type { EntityType } from "@freeanima/core/db/schema";

import type { EntityRow } from "./entity.ts";

export type EntitySearchMode = "hybrid" | "filter_only";

export type EntitySearchOpts = {
  /** 全文/语义 query；空则仅结构化筛选 */
  query?: string;
  world_id?: number;
  /** 跨 World 检索；须配合 accessible_world_ids 或内部解析 */
  global?: boolean;
  /** global 模式下可访问的 world id 白名单 */
  accessible_world_ids?: number[];
  type?: EntityType;
  types?: EntityType[];
  primary_component?: string;
  component?: string;
  /** 组件 Profile 白名单 filters（如 task_item.status） */
  filters?: Record<string, unknown>;
  created_after?: string;
  created_before?: string;
  updated_after?: string;
  updated_before?: string;
  limit?: number;
  offset?: number;
  mode?: EntitySearchMode;
};

export type EntitySearchHit = EntityRow & {
  rank?: number;
  snippet?: string;
};

export type EntitySearchResult = {
  query: string | null;
  limit: number;
  offset: number;
  count: number;
  results: EntitySearchHit[];
};

export interface EntitySearchPort {
  search(opts?: EntitySearchOpts): Promise<EntitySearchResult>;
  count(opts?: Omit<EntitySearchOpts, "offset" | "limit">): Promise<number>;
}
