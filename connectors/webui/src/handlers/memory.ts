import {
  autobiographicalMemoryListBodySchema,
  limbicMemoryListBodySchema,
  memorySearchBodySchema,
  semanticMemoryListBodySchema,
  type AutobiographicalMemoryListBody,
  type LimbicMemoryListBody,
  type MemorySearchBody,
  type SemanticMemoryListBody,
} from "@freeanima/connectors-webui/api";
import { getServiceContext } from "@freeanima/service-api";

export async function listMemoryFiles() {
  const { service } = getServiceContext();
  return service.listMemoryFiles();
}

export async function memorySearch(body: MemorySearchBody) {
  const parsed = memorySearchBodySchema.parse(body);
  const { service } = getServiceContext();
  return service.memorySearch({
    query: parsed.query,
    limit: parsed.limit,
    session: parsed.session,
  });
}

export async function countSemanticMemory() {
  const { service } = getServiceContext();
  const { index_rows } = await service.countSemanticMemory();
  return {
    ok: true as const,
    index_rows,
    message: `语义记忆共 ${index_rows} 条（PG content_fts 自动维护，无需重建索引）`,
  };
}

export async function listSemanticMemories(body: SemanticMemoryListBody) {
  const parsed = semanticMemoryListBodySchema.parse(body);
  const { service } = getServiceContext();
  return service.listSemanticMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    types: parsed.types,
    status: parsed.status,
    source_session: parsed.source_session?.trim() || undefined,
  });
}

export async function listLimbicMemories(body: LimbicMemoryListBody) {
  const parsed = limbicMemoryListBodySchema.parse(body);
  const { service } = getServiceContext();
  return service.listLimbicMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    session_id: parsed.session_id?.trim() || undefined,
    kind: parsed.kind,
  });
}

export async function listAutobiographicalMemories(body: AutobiographicalMemoryListBody) {
  const parsed = autobiographicalMemoryListBodySchema.parse(body);
  const { service } = getServiceContext();
  return service.listAutobiographicalMemories({
    query: parsed.query?.trim() || undefined,
    offset: parsed.offset,
    limit: parsed.limit,
    status: parsed.status,
    significance: parsed.significance,
    source_session: parsed.source_session?.trim() || undefined,
  });
}
