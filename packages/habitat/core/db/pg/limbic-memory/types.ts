import type { LimbicKind } from "@freeanima/habitat/core/db/schema/entity";
import type { LimbicMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

export type { LimbicKind, LimbicMemoryRow };

export type LimbicListOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  conversation_id?: string;
  kind?: LimbicKind;
};

export type LimbicListByConversationsOpts = {
  minIntensity?: number;
  limit?: number;
  orderBy?: "intensity_desc";
};

export type LimbicListByCreatedOpts = {
  minIntensity?: number;
  limit?: number;
  orderBy?: "intensity_desc";
};

export type LimbicFtsHit = LimbicMemoryRow & {
  rank: number;
};
