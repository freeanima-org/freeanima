import { resolveApiOrigin } from "./habitat-origin.ts";

/** Habitat RPC REST 路径（/rpc/v1/*），返回绝对 URL 供 fetch / EventSource 使用 */
export function apiPath(path: string): string {
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiOrigin()}${rel}`;
}
