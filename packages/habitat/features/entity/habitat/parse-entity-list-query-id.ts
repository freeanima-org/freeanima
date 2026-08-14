/**
 * 从管理页 `query` 解析精确实体 id。
 * 支持纯正整数与 `anima:{id}`（可带 query/hash）；拒绝 `anima://`。
 */
export function parseEntityListQueryId(query: string): number | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const id = Number(trimmed);
    return Number.isInteger(id) && id > 0 ? id : null;
  }

  if (trimmed.startsWith("anima://")) return null;
  if (!trimmed.startsWith("anima:")) return null;

  const rest = trimmed.slice("anima:".length);
  const idPart = rest.split(/[/?#]/)[0] ?? "";
  if (!/^\d+$/.test(idPart)) return null;
  const id = Number(idPart);
  return Number.isInteger(id) && id > 0 ? id : null;
}
