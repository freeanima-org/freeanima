/// <reference lib="dom" />

function resolveShellBasepath(): string {
  const raw = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "");
  if (!raw || raw === "." || !raw.startsWith("/")) return "";
  return raw;
}

/** 在 Shell 模块间导航（Web pathname / 原生 hash 路由）。 */
export function navigateShellModulePath(pathWithSearch: string): void {
  const path = pathWithSearch.startsWith("/") ? pathWithSearch : `/${pathWithSearch}`;
  const native = Boolean(window.satelliteShell?.isNativeShell);

  if (native) {
    const nextHash = path.startsWith("#") ? path : `#${path}`;
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
      return;
    }
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return;
  }

  const base = resolveShellBasepath();
  const target = `${base}${path}`;
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === target) {
    window.dispatchEvent(new PopStateEvent("popstate"));
    return;
  }
  window.history.pushState(null, "", target);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export type PomodoroLaunchParams = {
  taskId: number | null;
  autostart: boolean;
};

export function readPomodoroLaunchParamsFromLocation(): PomodoroLaunchParams {
  const search = window.location.search;
  const hash = window.location.hash;
  const query = search || (hash.includes("?") ? (hash.split("?")[1] ?? "") : "");
  const params = new URLSearchParams(query);
  const rawId = params.get("taskId");
  const taskId =
    rawId != null && Number.isInteger(Number(rawId)) && Number(rawId) > 0 ? Number(rawId) : null;
  const autostart = params.get("autostart") === "1" || params.get("autostart") === "true";
  return { taskId, autostart };
}

export function clearPomodoroLaunchParamsFromUrl(): void {
  const native = Boolean(window.satelliteShell?.isNativeShell);
  if (native) {
    const hash = window.location.hash;
    if (!hash.includes("?")) return;
    const route = hash.split("?")[0] ?? hash;
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${route}`,
    );
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("taskId");
  url.searchParams.delete("autostart");
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(null, "", next);
}
