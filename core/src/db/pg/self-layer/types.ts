import type { SelfBlockKey } from "@freeanima/core/db/schema";
import type { SelfBlockRow } from "@freeanima/core/db/schema/rows";

export type { SelfBlockKey, SelfBlockRow };

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
