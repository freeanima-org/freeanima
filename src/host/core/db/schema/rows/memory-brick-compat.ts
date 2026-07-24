import type {
  LimbicKind,
  NarrativeSignificance,
  NarrativeStatus,
} from "../entity/components/index.ts";

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
