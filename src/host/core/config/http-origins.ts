import type { HttpConfig } from "./schemas/http.ts";

/** 从 http.cors_origins 收集去重后的 origin 集合 */
export function collectHttpCorsOrigins(http?: HttpConfig | null): Set<string> {
  const origins = new Set<string>();
  for (const entry of http?.cors_origins ?? []) {
    const trimmed = entry.trim();
    if (trimmed) origins.add(trimmed);
  }
  return origins;
}
