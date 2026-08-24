/** Shell pathname → embedded bedroom inner route. */
export function resolveBedroomSubpath(shellPathname: string): string {
  for (const marker of ["/bedroom", "/observer"] as const) {
    const idx = shellPathname.indexOf(marker);
    if (idx === -1) continue;
    const rest = shellPathname.slice(idx + marker.length);
    if (!rest || rest === "/") return "/self-layer";
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return "/self-layer";
}

/** Embedded bedroom inner route → shell path under `/bedroom`. */
export function bedroomSubpathToShellPath(bedroomSubpath: string): string {
  const path = bedroomSubpath.startsWith("/") ? bedroomSubpath : `/${bedroomSubpath}`;
  if (path === "/" || path === "") return "/bedroom/self-layer";
  return `/bedroom${path}`;
}

function shellBasepathFromViteBase(baseUrl: string): string | undefined {
  const raw = baseUrl.replace(/\/$/, "");
  if (!raw || raw === "." || !raw.startsWith("/")) return undefined;
  return raw;
}

export function resolveEmbeddedBedroomBasepath(): string {
  const shellBase = shellBasepathFromViteBase(import.meta.env?.BASE_URL ?? "/");
  return shellBase ? `${shellBase}/bedroom` : "/bedroom";
}
