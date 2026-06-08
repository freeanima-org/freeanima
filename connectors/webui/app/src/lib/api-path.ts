/** API 在站点根路径，不在 /webui 下 */
export function apiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
