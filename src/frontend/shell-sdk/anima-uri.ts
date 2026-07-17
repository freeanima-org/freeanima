import { navigateShellModulePath } from "./pomodoro-launch.ts";

export type AnimaPresent = "navigate" | "overlay";

export type AnimaUriRef = {
  id: number;
  /** Component view facet; omit → resolve primary_component when opening */
  component?: string;
  present?: AnimaPresent;
};

export type ParseAnimaUriResult = { ok: true; ref: AnimaUriRef } | { ok: false; error: string };

const ANIMA_SCHEME = "anima:";

const DEFAULT_PRESENT_BY_COMPONENT: Record<string, AnimaPresent> = {
  task_item: "overlay",
  task_list: "navigate",
  semantic_memory: "overlay",
};

export function defaultPresentForComponent(component: string | undefined): AnimaPresent {
  if (component) {
    const mapped = DEFAULT_PRESENT_BY_COMPONENT[component];
    if (mapped) return mapped;
  }
  return "navigate";
}

export function formatAnimaUri(ref: AnimaUriRef): string {
  if (!Number.isInteger(ref.id) || ref.id <= 0) {
    throw new Error(`invalid anima uri id: ${String(ref.id)}`);
  }
  const params = new URLSearchParams();
  if (ref.component) params.set("component", ref.component);
  if (ref.present) params.set("present", ref.present);
  const qs = params.toString();
  return qs ? `${ANIMA_SCHEME}${ref.id}?${qs}` : `${ANIMA_SCHEME}${ref.id}`;
}

function parsePositiveIntId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePresent(raw: string | null): AnimaPresent | undefined {
  if (raw == null || raw === "") return undefined;
  if (raw === "navigate" || raw === "overlay") return raw;
  return undefined;
}

/**
 * Parse Anima URI (`anima:{id}?…`) or a Shell path (`/tasks?item=…`).
 * Rejects `anima://`.
 */
export function parseAnimaUri(input: string): ParseAnimaUriResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "empty" };

  if (trimmed.startsWith("anima://")) {
    return { ok: false, error: "anima:// is not supported; use anima:{id}" };
  }

  if (trimmed.startsWith(ANIMA_SCHEME)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return { ok: false, error: "invalid anima uri" };
    }
    if (parsed.protocol !== "anima:") {
      return { ok: false, error: "invalid scheme" };
    }
    const idRaw = parsed.pathname.replace(/^\//, "");
    const id = parsePositiveIntId(idRaw);
    if (id == null) return { ok: false, error: "invalid id" };

    const component = parsed.searchParams.get("component")?.trim() || undefined;
    if (parsed.searchParams.has("component") && !component) {
      return { ok: false, error: "invalid component" };
    }
    const presentRaw = parsed.searchParams.get("present");
    if (presentRaw != null && presentRaw !== "" && parsePresent(presentRaw) == null) {
      return { ok: false, error: "invalid present" };
    }
    const present = parsePresent(presentRaw);
    const ref: AnimaUriRef = { id };
    if (component) ref.component = component;
    if (present) ref.present = present;
    return { ok: true, ref };
  }

  if (trimmed.startsWith("/")) {
    return parseShellPathAsAnimaUri(trimmed);
  }

  return { ok: false, error: "unsupported uri" };
}

function parseShellPathAsAnimaUri(pathWithSearch: string): ParseAnimaUriResult {
  let url: URL;
  try {
    url = new URL(pathWithSearch, "http://anima.local");
  } catch {
    return { ok: false, error: "invalid shell path" };
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/tasks") {
    const itemRaw = url.searchParams.get("item")?.trim();
    if (itemRaw) {
      const id = parsePositiveIntId(itemRaw);
      if (id == null) return { ok: false, error: "invalid item id" };
      const present = parsePresent(url.searchParams.get("present")) ?? "overlay";
      return { ok: true, ref: { id, component: "task_item", present } };
    }
    const listRaw = url.searchParams.get("list")?.trim();
    if (listRaw) {
      const id = parsePositiveIntId(listRaw);
      if (id == null) return { ok: false, error: "invalid list id" };
      return { ok: true, ref: { id, component: "task_list", present: "navigate" } };
    }
    return { ok: false, error: "tasks path missing item or list" };
  }
  return { ok: false, error: "unsupported shell path" };
}

/** Map ref → Shell module path (for present=navigate or SPA sync). */
export function animaUriToShellPath(ref: AnimaUriRef): string | null {
  const component = ref.component;
  if (!component) return null;
  const present = ref.present ?? defaultPresentForComponent(component);
  if (component === "task_item") {
    const params = new URLSearchParams();
    params.set("item", String(ref.id));
    params.set("present", present);
    return `/tasks?${params}`;
  }
  if (component === "task_list") {
    return `/tasks?list=${ref.id}`;
  }
  return null;
}

/** Navigate Shell for present=navigate (or when overlay is unavailable). */
export function navigateAnimaUri(ref: AnimaUriRef): boolean {
  const path = animaUriToShellPath({
    ...ref,
    present: ref.present ?? defaultPresentForComponent(ref.component),
  });
  if (!path) return false;
  navigateShellModulePath(path);
  return true;
}
