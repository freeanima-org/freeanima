import { normalizeSemanticMemoryType, type SemanticMemory } from "./schemas/fact.ts";

export type { SemanticMemory };
export { normalizeSemanticMemoryType };

export function createSemanticMemory(partial: {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  source_conversations?: string[];
  observed_at?: string | Date | null;
  occurred_at?: string | null;
  status?: string;
  reference_count?: number;
  created_at?: Date;
  updated_at?: Date;
}): SemanticMemory {
  const now = new Date();
  const observed =
    partial.observed_at instanceof Date
      ? partial.observed_at
      : partial.observed_at
        ? new Date(partial.observed_at)
        : now;
  return {
    id: partial.id ?? "",
    type: normalizeSemanticMemoryType(partial.type),
    pinned: partial.pinned ?? false,
    content: partial.content.trim(),
    source_conversations: partial.source_conversations ?? [],
    observed_at: observed,
    occurred_at: partial.occurred_at ?? null,
    status: partial.status === "deprecated" ? "deprecated" : "active",
    reference_count: partial.reference_count ?? 0,
    created_at: partial.created_at ?? now,
    updated_at: partial.updated_at ?? partial.created_at ?? now,
  };
}
