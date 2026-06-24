import {
  autobiographicalMemoryListBodySchema,
  dreamMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  semanticMemoryPinBodySchema,
  type AutobiographicalMemoryListBody,
  type DreamMemoryListBody,
  type LimbicMemoryListBody,
  type MemorySearchBody,
  type SemanticMemoryListBody,
  type SemanticMemoryPinBody,
} from "@freeanima/admin-api/api";
import { adminCtx } from "./runtime.ts";

export async function listMemoryFiles() {
  return adminCtx().listMemoryFiles();
}

export async function memorySearch(body: MemorySearchBody) {
  const parsed = memorySearchBodySchema.parse(body);
  return adminCtx().memorySearch({
    query: parsed.query,
    limit: parsed.limit,
  });
}

export async function countSemanticMemory() {
  const { index_rows } = await adminCtx().countSemanticMemory();
  return {
    ok: true as const,
    index_rows,
    code: "semantic_memory_count" as const,
    params: { count: String(index_rows) },
  };
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  const parsed = semanticMemoryListBodySchema.parse(body);
  return adminCtx().listSemanticMemories({
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
  return adminCtx().listLimbicMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    conversation_id: parsed.conversation_id?.trim() || undefined,
    kind: parsed.kind,
  });
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  const parsed = autobiographicalMemoryListBodySchema.parse(body);
  return adminCtx().listAutobiographicalMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: parsed.status,
    significance: parsed.significance,
    source_conversation: parsed.source_conversation?.trim() || undefined,
  });
}

export async function listDreamMemories(body: DreamMemoryListBody) {
  const parsed = dreamMemoryListBodySchema.parse(body);
  return adminCtx().listDreamMemories({
    offset: parsed.offset,
    limit: parsed.limit,
  });
}

export async function getDreamMemory(day: string) {
  return adminCtx().getDreamMemoryByDay(day);
}

export async function updateSemanticMemoryPinned(body: SemanticMemoryPinBody) {
  const parsed = semanticMemoryPinBodySchema.parse(body);
  return adminCtx().updateSemanticMemoryPinned(parsed.id.trim(), parsed.pinned);
}
