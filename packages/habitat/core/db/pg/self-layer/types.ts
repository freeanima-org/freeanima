import type { SelfBlockKey } from "@freeanima/habitat/core/db/schema";
import type { SelfBlockRow } from "@freeanima/habitat/core/db/schema/rows";

export type { SelfBlockKey, SelfBlockRow };

/** Self-layer five blocks fixed order (system prompt injection) */
export const SELF_BLOCK_KEYS: SelfBlockKey[] = [
  "existence_anchor",
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
];

/** Blocks eligible for slow automatic maintenance proposals (not existence_anchor) */
export const SELF_BLOCK_MAINTAINABLE_KEYS = [
  "self_model",
  "personality_baseline",
  "direction",
  "metacognition",
] as const satisfies readonly SelfBlockKey[];

export type SelfBlockMaintainableKey = (typeof SELF_BLOCK_MAINTAINABLE_KEYS)[number];

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
