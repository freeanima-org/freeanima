/** tRPC / REST API 在站点根路径，不在 /webui 下 */
export function apiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

export function trpcWsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}${apiPath("/api/trpc/ws")}`;
}
