import { resolveApiOrigin } from "./hub-origin.ts";

/** Hub RPC REST 路径（/hub/rpc/v1/*），返回绝对 URL 供 fetch / EventSource 使用 */
export function apiPath(path: string): string {
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiOrigin()}${rel}`;
}
