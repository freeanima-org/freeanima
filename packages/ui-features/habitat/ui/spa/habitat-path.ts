/** Shell pathname → embedded console inner route. */
export function resolveHabitatSubpath(shellPathname: string): string {
  const marker = "/habitat";
  const idx = shellPathname.indexOf(marker);
  if (idx === -1) return "/dashboard";
  const rest = shellPathname.slice(idx + marker.length);
  if (!rest || rest === "/") return "/dashboard";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

/** Embedded console inner route → shell path under `/habitat`. */
export function habitatSubpathToShellPath(habitatSubpath: string): string {
  const path = habitatSubpath.startsWith("/") ? habitatSubpath : `/${habitatSubpath}`;
  if (path === "/" || path === "") return "/habitat/dashboard";
  return `/habitat${path}`;
}

function shellBasepathFromViteBase(baseUrl: string): string | undefined {
  const raw = baseUrl.replace(/\/$/, "");
  if (!raw || raw === "." || !raw.startsWith("/")) return undefined;
  return raw;
}

/** Habitat SPA base when embedded in app-ui (Habitat `/web/habitat`, desktop `/habitat`). */
export function resolveEmbeddedHabitatBasepath(): string {
  const shellBase = shellBasepathFromViteBase(import.meta.env?.BASE_URL ?? "/");
  return shellBase ? `${shellBase}/habitat` : "/habitat";
}
