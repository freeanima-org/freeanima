/** Shell pathname → embedded console inner route. */
export function resolveConsoleSubpath(shellPathname: string): string {
  const marker = "/console";
  const idx = shellPathname.indexOf(marker);
  if (idx === -1) return "/dashboard";
  const rest = shellPathname.slice(idx + marker.length);
  if (!rest || rest === "/") return "/dashboard";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

function shellBasepathFromViteBase(baseUrl: string): string | undefined {
  const raw = baseUrl.replace(/\/$/, "");
  if (!raw || raw === "." || !raw.startsWith("/")) return undefined;
  return raw;
}

/** Console SPA base when embedded in shell-ui (Hub `/web/console`, desktop `/console`). */
export function resolveEmbeddedConsoleBasepath(): string {
  const shellBase = shellBasepathFromViteBase(import.meta.env?.BASE_URL ?? "/");
  return shellBase ? `${shellBase}/console` : "/console";
}
