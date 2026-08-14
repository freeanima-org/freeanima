import type { AnimaPresent, AnimaUriRef } from "./anima-uri.ts";
import { defaultPresentForComponent, navigateAnimaUri, parseAnimaUri } from "./anima-uri.ts";

export type EntityOverlayOpenRequest = {
  id: number;
  /** 可为空：无 primary_component 时走通用浮层 */
  component: string;
  present: AnimaPresent;
};

type OverlayOpener = (req: EntityOverlayOpenRequest) => void;

let overlayOpener: OverlayOpener | null = null;

/** Resolve primary_component when URI omits component (optional). */
type PrimaryComponentResolver = (id: number) => Promise<string | null>;

let primaryResolver: PrimaryComponentResolver | null = null;

export function setEntityOverlayOpener(opener: OverlayOpener | null): void {
  overlayOpener = opener;
}

export function setAnimaUriPrimaryComponentResolver(
  resolver: PrimaryComponentResolver | null,
): void {
  primaryResolver = resolver;
}

export type OpenEntityResourceResult =
  | { ok: true; mode: "overlay" | "navigate" }
  | { ok: false; error: string };

const PARSE_ERROR_ZH: Record<string, string> = {
  empty: "链接为空",
  "anima:// is not supported; use anima:{id}": "不支持 anima://，请使用 anima:{id}",
  "invalid anima uri": "无效的 Anima 链接",
  "invalid scheme": "无效的协议",
  "invalid id": "无效的实体 id",
  "invalid component": "无效的 component",
  "invalid present": "无效的 present",
  "unsupported uri": "不支持的链接格式",
  "invalid shell path": "无效的路径",
  "invalid item id": "无效的任务 id",
  "invalid list id": "无效的清单 id",
  "tasks path missing item or list": "任务路径缺少 item 或 list",
  "projects path missing project": "项目路径缺少 project",
  "invalid project id": "无效的项目 id",
  "calendar path missing event": "日程路径缺少 event",
  "invalid event id": "无效的事件 id",
  "unsupported shell path": "不支持的壳路径",
};

function zhParseError(code: string): string {
  return PARSE_ERROR_ZH[code] ?? `无法打开：${code}`;
}

async function resolveComponent(ref: AnimaUriRef): Promise<string | null> {
  if (ref.component) return ref.component;
  if (!primaryResolver) return null;
  return primaryResolver(ref.id);
}

function openOverlay(id: number, component: string): OpenEntityResourceResult {
  if (!overlayOpener) {
    return { ok: false, error: "实体浮层未就绪，请稍后重试" };
  }
  overlayOpener({ id, component, present: "overlay" });
  return { ok: true, mode: "overlay" };
}

/**
 * Open an Anima URI or ref: overlay via registry Host, or navigate Shell path.
 * 无 component / 无专用浮层时打开通用实体详情。
 */
export async function openEntityResource(
  input: string | AnimaUriRef,
): Promise<OpenEntityResourceResult> {
  const parsed =
    typeof input === "string" ? parseAnimaUri(input) : ({ ok: true as const, ref: input } as const);
  if (!parsed.ok) return { ok: false, error: zhParseError(parsed.error) };

  const component = (await resolveComponent(parsed.ref))?.trim() || "";
  const present = parsed.ref.present ?? defaultPresentForComponent(component || undefined);
  const ref: AnimaUriRef = {
    ...parsed.ref,
    ...(component ? { component } : {}),
    present,
  };

  if (present === "navigate" && component) {
    if (navigateAnimaUri({ ...ref, component })) {
      return { ok: true, mode: "navigate" };
    }
  }

  return openOverlay(parsed.ref.id, component);
}

/** Expose for console / tests. */
export function bindOpenEntityResourceToWindow(): void {
  (window as Window & { openEntityResource?: typeof openEntityResource }).openEntityResource =
    openEntityResource;
}
