import type { ShellNavItem } from "./shell-nav-i18n.ts";

/** 底栏单项最小宽度（含图标 + text-xs 文案 + 触控区） */
export const SHELL_BOTTOM_NAV_MIN_TAB_WIDTH_PX = 56;

const TAB_HORIZONTAL_PADDING_PX = 12;
const TAB_LABEL_CHAR_WIDTH_PX = 12;

export function estimateShellBottomNavTabWidthPx(item: ShellNavItem): number {
  const label = item.label();
  const labelWidth = [...label].length * TAB_LABEL_CHAR_WIDTH_PX;
  return Math.max(SHELL_BOTTOM_NAV_MIN_TAB_WIDTH_PX, labelWidth + TAB_HORIZONTAL_PADDING_PX);
}

export function resolveShellBottomNavTabWidthPx(items: ShellNavItem[]): number {
  if (items.length === 0) return SHELL_BOTTOM_NAV_MIN_TAB_WIDTH_PX;
  return Math.max(
    SHELL_BOTTOM_NAV_MIN_TAB_WIDTH_PX,
    ...items.map(estimateShellBottomNavTabWidthPx),
  );
}

/** 根据可用宽度估算底栏最多可并排的 tab 数。 */
export function resolveShellBottomNavCapacity(
  viewportWidthPx: number,
  items: ShellNavItem[],
  safeAreaHorizontalPx = 0,
): number {
  if (items.length === 0) return 0;
  const available = Math.max(0, viewportWidthPx - safeAreaHorizontalPx);
  const tabWidth = resolveShellBottomNavTabWidthPx(items);
  return Math.max(1, Math.floor(available / tabWidth));
}

export function splitShellBottomNavItems(
  items: ShellNavItem[],
  capacity: number,
): { bar: ShellNavItem[]; more: ShellNavItem[] } {
  if (items.length === 0) return { bar: [], more: [] };
  if (items.length <= capacity) return { bar: items, more: [] };
  const barCount = Math.max(1, capacity - 1);
  return {
    bar: items.slice(0, barCount),
    more: items.slice(barCount),
  };
}

export function readShellBottomNavSafeAreaHorizontalPx(): number {
  if (typeof document === "undefined") return 0;
  const style = getComputedStyle(document.documentElement);
  const sal = Number.parseFloat(style.getPropertyValue("--sal")) || 0;
  const sar = Number.parseFloat(style.getPropertyValue("--sar")) || 0;
  return sal + sar;
}

export function readShellBottomNavViewportWidthPx(): number {
  if (typeof window === "undefined") return 0;
  return window.innerWidth;
}

export function layoutShellBottomNav(
  items: ShellNavItem[],
  viewportWidthPx: number,
  safeAreaHorizontalPx = 0,
): { bar: ShellNavItem[]; more: ShellNavItem[] } {
  const capacity = resolveShellBottomNavCapacity(viewportWidthPx, items, safeAreaHorizontalPx);
  return splitShellBottomNavItems(items, capacity);
}
