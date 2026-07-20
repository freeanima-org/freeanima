/** Vite `base` without trailing slash; undefined when served from `/` or relative `./`. */
export function shellBasepathFromViteBase(baseUrl: string): string | undefined {
  const raw = baseUrl.replace(/\/$/, "");
  if (!raw || raw === "." || !raw.startsWith("/")) return undefined;
  return raw;
}

export function resolveShellRouterBasepath(): string | undefined {
  return shellBasepathFromViteBase(import.meta.env?.BASE_URL ?? "/");
}

/** Habitat SPA base when embedded in shell-ui (Habitat `/web/habitat`, desktop `/habitat`). */
export function resolveEmbeddedHabitatBasepath(): string {
  const shellBase = resolveShellRouterBasepath();
  return shellBase ? `${shellBase}/habitat` : "/habitat";
}
