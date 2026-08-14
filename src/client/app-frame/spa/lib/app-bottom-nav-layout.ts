import type { AppNavItem } from "./app-nav-i18n.ts";

/** 满铺带文案时每项均分宽度下限 */
export const APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX = 44;

/** 满铺仅图标时每项均分宽度下限 */
export const APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX = 35;

/** More 按钮占位宽度 */
export const APP_BOTTOM_NAV_MORE_SLOT_WIDTH_PX = APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX;

export type AppBottomNavDensity = "label" | "icon";

export type AppBottomNavLayout = {
  bar: AppNavItem[];
  more: AppNavItem[];
  density: AppBottomNavDensity;
};

export type AppBottomNavLayoutOptions = {
  /** 常用模块个数上限；与宽度算法取 min。未设则仅按宽度。 */
  maxBarCount?: number | null;
};

export function resolveAppBottomNavAvailableWidth(
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
  items: AppNavItem[],
  available: number,
  slotWidth: number,
  density: AppBottomNavDensity,
): AppBottomNavLayout {
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

/**
 * 当前可用宽度下，底栏最多可平铺的模块数（与 layout 算法一致）。
 * 能满铺全部时返回 itemCount；否则按 More 槽位回退，至少 1。
 */
export function resolveAppBottomNavMaxBarCount(
  availableWidthPx: number,
  itemCount: number,
): number {
  if (itemCount <= 0) return 1;
  if (canFitAllEqual(itemCount, availableWidthPx, APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX)) {
    return itemCount;
  }
  const slotWidth = APP_BOTTOM_NAV_MORE_SLOT_WIDTH_PX;
  for (let barCount = itemCount - 1; barCount >= 1; barCount--) {
    if ((barCount + 1) * slotWidth <= availableWidthPx) {
      return barCount;
    }
  }
  return 1;
}

function densityForBarCount(barCount: number, availableWidthPx: number): AppBottomNavDensity {
  if (canFitAllEqual(barCount, availableWidthPx, APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX)) {
    return "label";
  }
  return "icon";
}

function applyMaxBarCount(
  items: AppNavItem[],
  availableWidthPx: number,
  layout: AppBottomNavLayout,
  maxBarCount: number,
): AppBottomNavLayout {
  const capped = Math.max(1, Math.floor(maxBarCount));
  if (layout.bar.length <= capped) return layout;
  if (items.length <= capped) {
    return {
      bar: items,
      more: [],
      density: densityForBarCount(items.length, availableWidthPx),
    };
  }
  return {
    bar: items.slice(0, capped),
    more: items.slice(capped),
    density: densityForBarCount(capped, availableWidthPx),
  };
}

export function layoutAppBottomNavItems(
  items: AppNavItem[],
  availableWidthPx: number,
  options?: AppBottomNavLayoutOptions,
): AppBottomNavLayout {
  if (items.length === 0) return { bar: [], more: [], density: "label" };

  let layout: AppBottomNavLayout;
  if (canFitAllEqual(items.length, availableWidthPx, APP_BOTTOM_NAV_MIN_LABEL_PER_ITEM_PX)) {
    layout = { bar: items, more: [], density: "label" };
  } else if (canFitAllEqual(items.length, availableWidthPx, APP_BOTTOM_NAV_MIN_ICON_PER_ITEM_PX)) {
    layout = { bar: items, more: [], density: "icon" };
  } else {
    layout = splitWithMoreFallback(
      items,
      availableWidthPx,
      APP_BOTTOM_NAV_MORE_SLOT_WIDTH_PX,
      "icon",
    );
  }

  const maxBarCount = options?.maxBarCount;
  if (maxBarCount == null || !Number.isFinite(maxBarCount)) return layout;
  return applyMaxBarCount(items, availableWidthPx, layout, maxBarCount);
}

export function readAppBottomNavSafeAreaHorizontalPx(): number {
  if (typeof document === "undefined") return 0;
  const style = getComputedStyle(document.documentElement);
  const sal = Number.parseFloat(style.getPropertyValue("--sal")) || 0;
  const sar = Number.parseFloat(style.getPropertyValue("--sar")) || 0;
  return sal + sar;
}

export function readAppBottomNavViewportWidthPx(): number {
  if (typeof window === "undefined") return 0;
  return window.innerWidth;
}

export function layoutAppBottomNav(
  items: AppNavItem[],
  viewportWidthPx: number,
  safeAreaHorizontalPx = 0,
  options?: AppBottomNavLayoutOptions,
): AppBottomNavLayout {
  const available = resolveAppBottomNavAvailableWidth(viewportWidthPx, safeAreaHorizontalPx);
  return layoutAppBottomNavItems(items, available, options);
}
