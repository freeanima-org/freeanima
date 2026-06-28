import type { SelfBlockKey } from "@freeanima/core/db/schema";

import type { SelfBlockRow } from "../schemas/self-block-row.ts";

export type { SelfBlockKey, SelfBlockRow };
export { selfBlockRowSchema } from "../schemas/self-block-row.ts";

/** Self-layer six blocks fixed order (system prompt injection) */
export const SELF_BLOCK_KEYS: SelfBlockKey[] = [
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
  "autobiography_summary",
];

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

/** Self-layer persistence port */
export interface SelfLayerStorePort {
  getBlock(key: SelfBlockKey): Promise<SelfBlockRow | null>;
  /** Return in SELF_BLOCK_KEYS order; missing keys as content="" */
  listBlocks(): Promise<SelfBlockRow[]>;
  upsertBlock(input: SelfBlockUpsertInput): Promise<void>;
  /** Locked blocks reject updates by default; force=true allows */
  updateBlock(input: SelfBlockUpdateInput, opts?: { force?: boolean }): Promise<void>;
}
