/** Semantic memory as entities row view (primary_component=semantic_memory). */
export type SemanticMemoryRow = {
  id: number;
  type: string;
  pinned: boolean;
  content: string;
  source_conversations: string[];
  observed_at: Date | null;
  occurred_at: string | null;
  status: string;
  reference_count: number;
  created_at: Date;
  updated_at: Date;
  world_id: number;
  legacy_id?: string;
};

export type SemanticFtsHit = SemanticMemoryRow & { rank: number };
