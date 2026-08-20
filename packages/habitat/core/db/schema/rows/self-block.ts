import type { SelfBlockKey } from "@freeanima/shared/pg-shapes/entity/enums.ts";

/** Self-layer block view (entity-backed; not a drizzle table row). */
export type SelfBlockRow = {
  block_key: SelfBlockKey;
  content: string;
  locked: boolean;
  version: number;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};
