/** 从 shell 路由 pathname 解析 habitat 子应用内路径（如 `/dashboard`） */
export function resolveHabitatSubpath(shellPathname: string): string {
  for (const marker of ["/habitat", "/console"] as const) {
    const idx = shellPathname.indexOf(marker);
    if (idx === -1) continue;
    const rest = shellPathname.slice(idx + marker.length);
    if (!rest || rest === "/") return "/dashboard";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return "/dashboard";
}
