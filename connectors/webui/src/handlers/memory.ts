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
} from "@freeanima/connectors-webui/api";
import { webuiCtx } from "./runtime.ts";

export async function listMemoryFiles() {
  return webuiCtx().listMemoryFiles();
}

export async function memorySearch(body: MemorySearchBody) {
  const parsed = memorySearchBodySchema.parse(body);
  return webuiCtx().memorySearch({
    query: parsed.query,
    limit: parsed.limit,
  });
}

export async function countSemanticMemory() {
  const { index_rows } = await webuiCtx().countSemanticMemory();
  return {
    ok: true as const,
    index_rows,
    code: "semantic_memory_count" as const,
    params: { count: String(index_rows) },
  };
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  const parsed = semanticMemoryListBodySchema.parse(body);
  return webuiCtx().listSemanticMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    types: parsed.types,
    status: parsed.status,
    source_session: parsed.source_session?.trim() || undefined,
    sort_by: parsed.sort_by,
  });
}

export async function listLimbicMemories(body: LimbicMemoryListBody) {
  const parsed = limbicMemoryListBodySchema.parse(body);
  return webuiCtx().listLimbicMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    session_id: parsed.session_id?.trim() || undefined,
    kind: parsed.kind,
  });
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  const parsed = autobiographicalMemoryListBodySchema.parse(body);
  return webuiCtx().listAutobiographicalMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: parsed.status,
    significance: parsed.significance,
    source_session: parsed.source_session?.trim() || undefined,
  });
}

export async function updateSemanticMemoryPinned(body: SemanticMemoryPinBody) {
  const parsed = semanticMemoryPinBodySchema.parse(body);
  return webuiCtx().updateSemanticMemoryPinned(parsed.id.trim(), parsed.pinned);
}
