import type { EntityType } from "@freeanima/core/db/schema";
import type { EntityRow } from "@freeanima/core/db/schema/entity";

export type { EntityRow };

export type EntityCreateInput = {
  type: EntityType;
  world_id: number;
  components: string[];
  primary_component: string;
  title?: string;
  summary?: string;
  content?: string;
  body: Record<string, unknown>;
};

export type EntityUpdateInput = {
  id: number;
  world_id?: number;
  components?: string[];
  title?: string;
  summary?: string;
  content?: string;
  body?: Record<string, unknown>;
};

export type EntityListOpts = {
  world_id?: number;
  type?: EntityType;
  types?: EntityType[];
  primary_component?: string;
  component?: string;
  limit?: number;
  offset?: number;
};

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
  /**
   * 默认 true。false 时跳过额外 COUNT 查询，`count` 回落为当前页 `results.length`
   *（适合 listTaskItems 等不读 total 的调用方）。
   */
  include_count?: boolean;
  /**
   * `list`：不拉 content（email/vault 列表）；默认 `full`。
   */
  projection?: "full" | "list";
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
