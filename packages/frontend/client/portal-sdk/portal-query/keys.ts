/** 稳定序列化 query key（数组或字符串）。 */
export type PortalQueryKey = readonly unknown[] | string;

export function hashQueryKey(key: PortalQueryKey): string {
  if (typeof key === "string") return key;
  return JSON.stringify(key);
}

/** 与 IDB `scope|namespace|id` 对齐的便捷 key（亦可用作 PortalQueryKey 字符串）。 */
export function portalCacheKey(scope: string, namespace: string, id: string): string {
  return `${scope}|${namespace}|${id}`;
}
