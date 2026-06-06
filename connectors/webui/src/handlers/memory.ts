import { memorySearchBodySchema, type MemorySearchBody } from "@freeanima/connectors-webui/api";
import { getServiceContext } from "@freeanima/service-api";

export function listMemoryFiles() {
  const { service } = getServiceContext();
  return service.listMemoryFiles();
}

export function memorySearch(body: MemorySearchBody) {
  const parsed = memorySearchBodySchema.parse(body);
  const { service } = getServiceContext();
  return service.memorySearch({
    query: parsed.query,
    limit: parsed.limit,
    session_limit: parsed.session_limit,
    session: parsed.session,
  });
}

export async function memoryL2Distill() {
  const { service } = getServiceContext();
  const { sessions } = await service.distillL2All();
  return {
    ok: true as const,
    sessions,
    message: `L2 蒸馏完成：${sessions} 个 session 已写入 processed/`,
  };
}

export function memoryL2Reindex() {
  const { service } = getServiceContext();
  const { index_rows } = service.reindexL2All();
  return {
    ok: true as const,
    index_rows,
    message: `L2 索引重建完成：${index_rows} 条消息已索引`,
  };
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

export async function memoryL2Rebuild() {
  const { service } = getServiceContext();
  const { sessions, index_rows } = await service.rebuildL2All();
  return {
    ok: true as const,
    sessions,
    index_rows,
    message: `L2 全量重建完成：${sessions} 个 session 已蒸馏，${index_rows} 条消息已索引`,
  };
}
