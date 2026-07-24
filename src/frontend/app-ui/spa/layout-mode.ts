/** 布局层粗档：移动布局 vs 桌面布局，仅视口断点（与壳能力解耦） */
import { useEffect, useState } from "react";
import { COMPACT_LAYOUT_MQ } from "@freeanima/frontend/ui-kit/layout";

export type LayoutMode = "compact" | "expanded";

export type LayoutModeContext = {
  /** URL ?layout=compact|expanded */
  layoutOverride?: string | null;
  /** /web/config.json layout_mode */
  configLayoutMode?: LayoutMode | null;
  isNarrowViewport?: boolean;
};

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

/** 浏览器 / 远程 UI 运行时解析布局粗档（窄→compact，中宽→expanded） */
export function detectLayoutMode(configLayoutMode?: LayoutMode | null): LayoutMode {
  const fromWindow =
    typeof window !== "undefined"
      ? (window as Window & { __freeanimaWebUiConfig?: { layout_mode?: LayoutMode } })
          .__freeanimaWebUiConfig?.layout_mode
      : undefined;
  return resolveLayoutMode({
    layoutOverride: readLayoutOverrideFromLocation(),
    configLayoutMode: configLayoutMode ?? fromWindow ?? null,
    isNarrowViewport: readMedia(COMPACT_LAYOUT_MQ),
  });
}

export function isCompactLayout(mode: LayoutMode): boolean {
  return mode === "compact";
}

/** 随视口变化更新布局粗档（与 useDrawerNav 同断点） */
export function useLayoutMode(configLayoutMode?: LayoutMode | null): LayoutMode {
  const [mode, setMode] = useState(() => detectLayoutMode(configLayoutMode));

  useEffect(() => {
    const sync = () => setMode(detectLayoutMode(configLayoutMode));
    sync();
    const mq = window.matchMedia(COMPACT_LAYOUT_MQ);
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, [configLayoutMode]);

  return mode;
}
