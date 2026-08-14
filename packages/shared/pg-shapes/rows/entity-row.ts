/**
 * Entity 行视图（无 drizzle）——供 frontend / protocol 使用的结构类型。
 * host `schema/entity/views` 可收窄 `type` / `revisions`；此处保持可共享的结构。
 */
export type EntityRow = {
  id: number;
  type: string;
  world_id: number;
  components: string[];
  /** 空壳时为 null */
  primary_component: string | null;
  title: string;
  summary: string;
  content: string;
  body: Record<string, unknown>;
  pinned: boolean;
  reference_count: number;
  tag_ids: number[];
  /** 顶层版本快照；list projection 可能为空数组 */
  revisions: unknown[];
  /** 软删时间；null 表示存活 */
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};
