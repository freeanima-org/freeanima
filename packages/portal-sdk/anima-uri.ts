import { navigateAppModulePath } from "./pomodoro-launch.ts";
import { writeModuleSelection } from "./module-selection.ts";

export type AnimaPresent = "navigate" | "overlay";

export type AnimaUriRef = {
  id: number;
  /** Component view facet; omit → resolve primary_component when opening */
  component?: string;
  present?: AnimaPresent;
  /**
   * Habitat 实例 id（`fa_inst_…`）。省略 = 本机。
   * 异机值仅保留解析结果；本切片不实现远程打开。
   */
  habitat_instance_id?: string;
};

export type ParseAnimaUriResult = { ok: true; ref: AnimaUriRef } | { ok: false; error: string };

const ANIMA_SCHEME = "anima:";

const DEFAULT_PRESENT_BY_COMPONENT: Record<string, AnimaPresent> = {
  task_item: "overlay",
  task_list: "navigate",
  semantic_memory: "overlay",
  calendar_event: "overlay",
  project: "overlay",
  note: "navigate",
  diary_entry: "navigate",
  email_account: "navigate",
  object_file: "overlay",
};

export function defaultPresentForComponent(component: string | undefined): AnimaPresent {
  if (component) {
    const mapped = DEFAULT_PRESENT_BY_COMPONENT[component];
    if (mapped) return mapped;
  }
  /** 未知组件 / 空壳：默认浮层（通用实体详情） */
  return "overlay";
}

export function formatAnimaUri(ref: AnimaUriRef): string {
  if (!Number.isInteger(ref.id) || ref.id <= 0) {
    throw new Error(`invalid anima uri id: ${String(ref.id)}`);
  }
  const params = new URLSearchParams();
  if (ref.component) params.set("component", ref.component);
  if (ref.present) params.set("present", ref.present);
  if (ref.habitat_instance_id) params.set("habitat_instance_id", ref.habitat_instance_id);
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
    const habitat_instance_id = parsed.searchParams.get("habitat_instance_id")?.trim() || undefined;
    if (parsed.searchParams.has("habitat_instance_id") && !habitat_instance_id) {
      return { ok: false, error: "invalid habitat_instance_id" };
    }
    const ref: AnimaUriRef = { id };
    if (component) ref.component = component;
    if (present) ref.present = present;
    if (habitat_instance_id) ref.habitat_instance_id = habitat_instance_id;
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
  if (path === "/projects") {
    const projectRaw = url.searchParams.get("project")?.trim();
    if (!projectRaw) return { ok: false, error: "projects path missing project" };
    const id = parsePositiveIntId(projectRaw);
    if (id == null) return { ok: false, error: "invalid project id" };
    return { ok: true, ref: { id, component: "project", present: "navigate" } };
  }
  if (path === "/calendar") {
    const eventRaw = url.searchParams.get("event")?.trim();
    if (!eventRaw) return { ok: false, error: "calendar path missing event" };
    const id = parsePositiveIntId(eventRaw);
    if (id == null) return { ok: false, error: "invalid event id" };
    return { ok: true, ref: { id, component: "calendar_event", present: "navigate" } };
  }
  if (path === "/note") {
    const idRaw = url.searchParams.get("id")?.trim();
    if (!idRaw) return { ok: false, error: "note path missing id" };
    const id = parsePositiveIntId(idRaw);
    if (id == null) return { ok: false, error: "invalid id" };
    return { ok: true, ref: { id, component: "note", present: "navigate" } };
  }
  if (path === "/diary") {
    const idRaw = url.searchParams.get("id")?.trim();
    if (!idRaw) return { ok: false, error: "diary path missing id" };
    const id = parsePositiveIntId(idRaw);
    if (id == null) return { ok: false, error: "invalid id" };
    return { ok: true, ref: { id, component: "diary_entry", present: "navigate" } };
  }
  if (path === "/email") {
    const accountRaw = url.searchParams.get("account")?.trim();
    if (!accountRaw) return { ok: false, error: "email path missing account" };
    const id = parsePositiveIntId(accountRaw);
    if (id == null) return { ok: false, error: "invalid account id" };
    return { ok: true, ref: { id, component: "email_account", present: "navigate" } };
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
  if (component === "project") {
    return `/projects?project=${ref.id}`;
  }
  if (component === "calendar_event") {
    return `/calendar?event=${ref.id}`;
  }
  if (component === "note") {
    return `/note?id=${ref.id}`;
  }
  if (component === "diary_entry") {
    return `/diary?id=${ref.id}`;
  }
  if (component === "email_account") {
    return `/email?account=${ref.id}`;
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
  // 同模块内切清单时 TaskApp 已挂载，需同步持久化选型，避免只改 URL 不换列表
  if (ref.component === "task_list" && Number.isInteger(ref.id) && ref.id > 0) {
    writeModuleSelection("tasks", { kind: "list", id: ref.id });
  }
  navigateAppModulePath(path);
  return true;
}
