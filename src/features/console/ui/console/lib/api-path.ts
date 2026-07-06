import { resolveApiOrigin } from "./hub-origin.ts";

/** API 在 Hub 站点根路径 /api/*，返回绝对 URL 供 fetch / EventSource 使用 */
export function apiPath(path: string): string {
  const rel = path.startsWith("/") ? path : `/${path}`;
  return `${resolveApiOrigin()}${rel}`;
}
