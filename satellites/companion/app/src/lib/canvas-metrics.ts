import { isTauri } from "@/lib/tauri.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  WEB_COMPANION_HEIGHT,
  WEB_COMPANION_WIDTH,
} from "@/lib/window-metrics.ts";

/** 读取伴侣角色 canvas 应对齐的像素尺寸（与 CSS 可视区域一致） */
export function measureCharacterViewportSize(
  container: HTMLElement | null,
  canvas: HTMLCanvasElement,
): { width: number; height: number } {
  if (!isTauri()) {
    return { width: WEB_COMPANION_WIDTH, height: WEB_COMPANION_HEIGHT };
  }

  const el = container ?? canvas;
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  if (width > 1 && height > 1) {
    return { width, height };
  }

  return { width: COMPANION_WINDOW_WIDTH, height: COMPANION_WINDOW_HEIGHT };
}
