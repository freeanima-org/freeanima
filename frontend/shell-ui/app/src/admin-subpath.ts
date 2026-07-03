/** 从 shell 路由 pathname 解析 admin 子应用内路径（如 `/dashboard`） */
export function resolveAdminSubpath(shellPathname: string): string {
  const marker = "/admin";
  const idx = shellPathname.indexOf(marker);
  if (idx === -1) return "/dashboard";
  const rest = shellPathname.slice(idx + marker.length);
  if (!rest || rest === "/") return "/dashboard";
  return rest.startsWith("/") ? rest : `/${rest}`;
}
