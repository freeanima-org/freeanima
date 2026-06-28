import { formatCstIso } from "@freeanima/core/util";

import { normalizeSemanticMemoryType, type SemanticMemory } from "./schemas/fact.ts";

export type { SemanticMemory };
export { normalizeSemanticMemoryType };

export function createSemanticMemory(partial: {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  source_conversations?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
  reference_count?: number;
  created?: string;
  updated?: string;
}): SemanticMemory {
  const now = formatCstIso();
  return {
    id: partial.id ?? "",
    type: normalizeSemanticMemoryType(partial.type),
    pinned: partial.pinned ?? false,
    content: partial.content.trim(),
    source_conversations: partial.source_conversations ?? [],
    observed_at: partial.observed_at ?? now,
    occurred_at: partial.occurred_at ?? null,
    status: partial.status === "deprecated" ? "deprecated" : "active",
    reference_count: partial.reference_count ?? 0,
    created: partial.created ?? now,
    updated: partial.updated ?? now,
  };
}
