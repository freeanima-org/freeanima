import type { LimbicKind } from "../entity/limbic.ts";
import type { NarrativeSignificance, NarrativeStatus } from "../entity/narrative.ts";

/** 语义记忆 provenance（与 habitat MemoryProvenance / body.source 同形） */
export type SemanticMemoryProvenance = {
  conversation_id: string;
  message_id_from?: string;
  message_id_to?: string;
  message_ids?: string[];
};

export type SemanticMemoryLinkType =
  | "merged_from"
  | "supersedes"
  | "conflicts_with"
  | "derived_from";

export type SemanticMemoryLink = {
  type: SemanticMemoryLinkType;
  memory_id: number;
};

/** Semantic memory as entities row view (primary_component=semantic_memory). */
export type SemanticMemoryRow = {
  id: number;
  type: string;
  pinned: boolean;
  content: string;
  source_conversations: string[];
  /** body.source；缺省时由 source_conversations 在 MemoryService 层映射 */
  source?: SemanticMemoryProvenance | null;
  links?: SemanticMemoryLink[];
  observed_at: Date | null;
  occurred_at: string | null;
  status: string;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  world_id: number;
  legacy_id?: string;
};

export type SemanticFtsHit = SemanticMemoryRow & {
  rank: number;
  /** search_documents.cluster_id；无索引行或噪声为 null */
  cluster_id: number | null;
};

export type LimbicMemoryRow = {
  id: string;
  conversation_id: string;
  kind: LimbicKind;
  valence: number | null;
  arousal: number | null;
  content: string;
  intensity: number;
  source_segment: string | null;
  semantic_memory_ids: number[];
  created_at: Date;
  fts_segmented: string | null;
  content_embedding: null;
};

export type AutobiographicalMemoryRow = {
  id: string;
  title: string;
  content: string;
  significance: NarrativeSignificance;
  period_start: string | null;
  period_end: string | null;
  source_facts: number[];
  source_conversations: string[];
  status: NarrativeStatus;
  created_at: Date;
  updated_at: Date;
  fts_segmented: string | null;
  content_embedding: null;
};
