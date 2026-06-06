import { formatCstIso } from "@freeanima/kernel-util";

import { normalizeSemanticMemoryType, type SemanticMemory } from "./schemas/fact.ts";

export type { SemanticMemory };
export { normalizeSemanticMemoryType };

export function createSemanticMemory(partial: {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  created?: string;
  updated?: string;
}): SemanticMemory {
  const now = formatCstIso();
  return {
    id: partial.id ?? "",
    type: normalizeSemanticMemoryType(partial.type),
    pinned: partial.pinned ?? false,
    content: partial.content.trim(),
    created: partial.created ?? now,
    updated: partial.updated ?? now,
  };
}
