import type { SelfBlockKey } from "@freeanima/engine-db/schema";

export type { SelfBlockKey };

/** 自我层六块固定顺序（system prompt 注入） */
export const SELF_BLOCK_KEYS: SelfBlockKey[] = [
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
  "autobiography_summary",
];

/** PG self_blocks 行 */
export type SelfBlockRow = {
  block_key: SelfBlockKey;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created: string;
  updated: string;
};

export type SelfBlockUpsertInput = {
  block_key: SelfBlockKey;
  content: string;
  locked?: boolean;
  updated_by?: string;
};

export type SelfBlockUpdateInput = {
  block_key: SelfBlockKey;
  content?: string;
  locked?: boolean;
  updated_by?: string;
};

/** 自我层持久化端口 */
export interface SelfLayerStorePort {
  getBlock(key: SelfBlockKey): Promise<SelfBlockRow | null>;
  /** 按 SELF_BLOCK_KEYS 顺序返回；缺失键视为 content="" */
  listBlocks(): Promise<SelfBlockRow[]>;
  upsertBlock(input: SelfBlockUpsertInput): Promise<void>;
  /** locked 块默认拒绝更新；force=true 时允许 */
  updateBlock(input: SelfBlockUpdateInput, opts?: { force?: boolean }): Promise<void>;
  isInitialized(): Promise<boolean>;
}
