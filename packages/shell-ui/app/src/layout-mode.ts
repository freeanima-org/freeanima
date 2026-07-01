/** 呈现轴：nav IA / settings 侧栏布局，与壳能力（satelliteShell）解耦 */
import { useEffect, useState } from "react";
import { MOBILE_LAYOUT_MQ } from "@freeanima/ui-kit/layout";

export type LayoutMode = "compact" | "expanded";

export type LayoutModeContext = {
  isElectron?: boolean;
  /** URL ?layout=compact|expanded */
  layoutOverride?: string | null;
  /** /web/config.json layout_mode */
  configLayoutMode?: LayoutMode | null;
  isStandalonePwa?: boolean;
  isCapacitor?: boolean;
  isNarrowViewport?: boolean;
};

const STANDALONE_QUERY = "(display-mode: standalone)";

export function parseLayoutModeOverride(raw: string | null | undefined): LayoutMode | null {
  const v = raw?.trim().toLowerCase();
  if (v === "compact" || v === "mobile") return "compact";
  if (v === "expanded" || v === "desktop") return "expanded";
  return null;
}

export function resolveLayoutMode(ctx: LayoutModeContext = {}): LayoutMode {
  const fromUrl = parseLayoutModeOverride(ctx.layoutOverride);
  if (fromUrl) return fromUrl;
  if (ctx.configLayoutMode) return ctx.configLayoutMode;

  if (ctx.isElectron) return "expanded";

  if (ctx.isStandalonePwa || ctx.isCapacitor) return "compact";
  if (ctx.isNarrowViewport) return "compact";

  return "expanded";
}

function readLayoutOverrideFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("layout");
}

function readMedia(query: string): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(query).matches;
}

function isCapacitorRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

/** 浏览器 / 远程 UI 运行时解析呈现模式 */
export function detectLayoutMode(configLayoutMode?: LayoutMode | null): LayoutMode {
  const fromWindow =
    typeof window !== "undefined"
      ? (window as Window & { __freeanimaWebUiConfig?: { layout_mode?: LayoutMode } })
          .__freeanimaWebUiConfig?.layout_mode
      : undefined;
  return resolveLayoutMode({
    isElectron: window.satelliteShell?.isElectron,
    layoutOverride: readLayoutOverrideFromLocation(),
    configLayoutMode: configLayoutMode ?? fromWindow ?? null,
    isStandalonePwa: readMedia(STANDALONE_QUERY),
    isCapacitor: isCapacitorRuntime(),
    isNarrowViewport: readMedia(MOBILE_LAYOUT_MQ),
  });
}

export function isCompactLayout(mode: LayoutMode): boolean {
  return mode === "compact";
}

/** 随视口 / 壳环境变化更新呈现模式（与 useDrawerNav 同断点） */
export function useLayoutMode(configLayoutMode?: LayoutMode | null): LayoutMode {
  const [mode, setMode] = useState(() => detectLayoutMode(configLayoutMode));

  useEffect(() => {
    const sync = () => setMode(detectLayoutMode(configLayoutMode));
    sync();
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [configLayoutMode]);

  return mode;
}
