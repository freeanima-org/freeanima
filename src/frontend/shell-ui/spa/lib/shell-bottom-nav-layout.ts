import type { ShellNavItem } from "./shell-nav-i18n.ts";

/** 满铺带文案时每项均分宽度下限 */
export const SHELL_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX = 44;

/** 满铺仅图标时每项均分宽度下限 */
export const SHELL_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX = 35;

/** More 按钮占位宽度 */
export const SHELL_BOTTOM_NAV_MORE_SLOT_WIDTH_PX = SHELL_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX;

export type ShellBottomNavDensity = "label" | "icon";

export type ShellBottomNavLayout = {
  bar: ShellNavItem[];
  more: ShellNavItem[];
  density: ShellBottomNavDensity;
};

export function resolveShellBottomNavAvailableWidth(
  viewportWidthPx: number,
  safeAreaHorizontalPx = 0,
): number {
  return Math.max(0, viewportWidthPx - safeAreaHorizontalPx);
}

function perItemWidth(itemsCount: number, available: number): number {
  if (itemsCount === 0) return available;
  return available / itemsCount;
}

function canFitAllEqual(itemsCount: number, available: number, minPerItem: number): boolean {
  if (itemsCount === 0) return true;
  return perItemWidth(itemsCount, available) >= minPerItem;
}

function splitWithMoreFallback(
  items: ShellNavItem[],
  available: number,
  slotWidth: number,
  density: ShellBottomNavDensity,
): ShellBottomNavLayout {
  if (items.length === 0) return { bar: [], more: [], density };

  for (let barCount = items.length - 1; barCount >= 1; barCount--) {
    const slots = barCount + 1;
    if (slots * slotWidth <= available) {
      return {
        bar: items.slice(0, barCount),
        more: items.slice(barCount),
        density,
      };
    }
  }

  return {
    bar: items.slice(0, 1),
    more: items.slice(1),
    density,
  };
}

export function layoutShellBottomNavItems(
  items: ShellNavItem[],
  availableWidthPx: number,
): ShellBottomNavLayout {
  if (items.length === 0) return { bar: [], more: [], density: "label" };

  if (canFitAllEqual(items.length, availableWidthPx, SHELL_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX)) {
    return { bar: items, more: [], density: "label" };
  }

  if (canFitAllEqual(items.length, availableWidthPx, SHELL_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX)) {
    return { bar: items, more: [], density: "icon" };
  }

  return splitWithMoreFallback(
    items,
    availableWidthPx,
    SHELL_BOTTOM_NAV_MORE_SLOT_WIDTH_PX,
    "icon",
  );
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
): ShellBottomNavLayout {
  const available = resolveShellBottomNavAvailableWidth(viewportWidthPx, safeAreaHorizontalPx);
  return layoutShellBottomNavItems(items, available);
}
