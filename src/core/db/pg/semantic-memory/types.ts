import type { SemanticFtsHit, SemanticMemoryRow } from "@freeanima/core/db/schema/rows";

/** Default resident memory slot count injected into system prompt */
export const RESIDENT_TOP_N = 20;

/** Max pinned memories included in resident context (excess triggers warn log) */
export const RESIDENT_PINNED_MAX = 40;

export type { SemanticFtsHit, SemanticMemoryRow };

export type SemanticMemoryCreateInput = {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  source_conversations?: string[];
  observed_at?: string | Date | null;
  occurred_at?: string | null;
  status?: string;
  created_at?: Date;
  updated_at?: Date;
};

/** Overlay update: only passed fields change; source_conversations [] clears */
export type SemanticMemoryUpdateInput = {
  id: string;
  content?: string;
  type?: string;
  pinned?: boolean;
  source_conversations?: string[];
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

export {
  semanticFtsHitSchema,
  semanticMemoryRowSchema,
} from "@freeanima/core/repos/schemas/semantic-memory-row.ts";
