import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
  type AutobiographicalMemoryListBody,
  type LimbicMemoryListBody,
  type MemorySearchBody,
  type SemanticMemoryListBody,
  type SemanticMemoryPinBody,
} from "@freeanima/features/console/hub/console-api/api";
import { consoleCtx } from "./runtime.ts";

export async function listMemoryFiles() {
  return consoleCtx().listMemoryFiles();
}

export async function memorySearch(body: MemorySearchBody) {
  const parsed = memorySearchBodySchema.parse(body);
  return consoleCtx().memorySearch({
    query: parsed.query,
    limit: parsed.limit,
  });
}

export async function countSemanticMemory() {
  const { index_rows } = await consoleCtx().countSemanticMemory();
  return {
    ok: true as const,
    index_rows,
    code: "semantic_memory_count" as const,
    params: { count: String(index_rows) },
  };
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  const parsed = semanticMemoryListBodySchema.parse(body);
  return consoleCtx().listSemanticMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    types: parsed.types,
    status: parsed.status,
    source_conversation: parsed.source_conversation?.trim() || undefined,
    sort_by: parsed.sort_by,
  });
}

export async function listLimbicMemories(body: LimbicMemoryListBody) {
  const parsed = limbicMemoryListBodySchema.parse(body);
  return consoleCtx().listLimbicMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    conversation_id: parsed.conversation_id?.trim() || undefined,
    kind: parsed.kind,
  });
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  const parsed = autobiographicalMemoryListBodySchema.parse(body);
  return consoleCtx().listAutobiographicalMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: parsed.status,
    significance: parsed.significance,
    source_conversation: parsed.source_conversation?.trim() || undefined,
  });
}

export async function updateSemanticMemoryPinned(body: SemanticMemoryPinBody) {
  const parsed = semanticMemoryPinBodySchema.parse(body);
  return consoleCtx().updateSemanticMemoryPinned(parsed.id, parsed.pinned);
}
