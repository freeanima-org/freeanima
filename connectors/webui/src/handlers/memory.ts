import { memorySearchBodySchema, type MemorySearchBody } from "@freeanima/connectors-webui/api";
import { getServiceContext } from "@freeanima/service-api";

export function listMemoryFiles() {
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

export function memoryL3Reindex() {
  const { service } = getServiceContext();
  const { index_rows } = service.reindexL3All();
  return {
    ok: true as const,
    index_rows,
    message: `L3 索引重建完成：${index_rows} 条事实已索引`,
  };
}
