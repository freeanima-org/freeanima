import { z } from "zod";

import type { SemanticFtsHit, SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import {
  DEFAULT_RESIDENT_PINNED_MAX,
  DEFAULT_RESIDENT_TOP_N,
} from "@freeanima/habitat/core/config/schemas/memory-config";

/** @deprecated 使用 resolveMemoryResidentConfig().top_n；常量保留兼容默认值 */
export const RESIDENT_TOP_N = DEFAULT_RESIDENT_TOP_N;

/** @deprecated 使用 resolveMemoryResidentConfig().pinned_max */
export const RESIDENT_PINNED_MAX = DEFAULT_RESIDENT_PINNED_MAX;

export type { SemanticFtsHit, SemanticMemoryRow };

import type {
  SemanticMemoryLink,
  SemanticMemoryProvenance,
} from "@freeanima/shared/pg-shapes/rows/memory-rows.ts";

export type { SemanticMemoryLink, SemanticMemoryProvenance };

export type SemanticMemoryCreateInput = {
  content: string;
  type?: string;
  pinned?: boolean;
  /** @deprecated ignored — entity ids are identity-generated */
  id?: string | number;
  world_id?: number;
  source_conversations?: string[];
  /** #16102 真源 provenance；写入 body.source，并回填 source_conversations */
  source?: SemanticMemoryProvenance;
  links?: SemanticMemoryLink[];
  observed_at?: string | Date | null;
  occurred_at?: string | null;
  status?: string;
  created_at?: Date;
  updated_at?: Date;
};

/** Overlay update: only passed fields change; source_conversations [] clears */
export type SemanticMemoryUpdateInput = {
  id: string | number;
  content?: string;
  type?: string;
  pinned?: boolean;
  source_conversations?: string[];
  source?: SemanticMemoryProvenance;
  links?: SemanticMemoryLink[];
  observed_at?: string | Date | null;
  occurred_at?: string | null;
  status?: string;
};

export type SemanticMemorySortBy = "created_at" | "updated_at" | "reference_count" | "rank";

export type SemanticMemorySearchOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  types?: string[];
  status?: "active" | "deprecated" | "all";
  source_conversations?: string[];
  sort_by?: SemanticMemorySortBy;
};

/** HTTP / tool validation for semantic memory rows (subset of table columns). */
export const semanticMemoryRowSchema = z.object({
  id: z.number().int().positive(),
  type: z.string(),
  pinned: z.boolean(),
  content: z.string(),
  source_conversations: z.array(z.string()),
  observed_at: z.coerce.date().nullable(),
  occurred_at: z.string().nullable(),
  status: z.string(),
  reference_count: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  world_id: z.number().int().positive().optional(),
});

export type SemanticMemoryRowSchema = z.infer<typeof semanticMemoryRowSchema>;

export const semanticFtsHitSchema = semanticMemoryRowSchema.extend({
  rank: z.number(),
});

export type SemanticFtsHitSchema = z.infer<typeof semanticFtsHitSchema>;
