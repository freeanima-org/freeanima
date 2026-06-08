import { memorySearchBodySchema, type MemorySearchBody } from "@freeanima/connectors-webui/api";
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
    session_limit: parsed.session_limit,
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
