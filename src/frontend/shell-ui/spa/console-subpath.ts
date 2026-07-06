/** 从 shell 路由 pathname 解析 console 子应用内路径（如 `/dashboard`） */
export function resolveConsoleSubpath(shellPathname: string): string {
  const marker = "/console";
  const idx = shellPathname.indexOf(marker);
  if (idx === -1) return "/dashboard";
  const rest = shellPathname.slice(idx + marker.length);
  if (!rest || rest === "/") return "/dashboard";
  return rest.startsWith("/") ? rest : `/${rest}`;
}
