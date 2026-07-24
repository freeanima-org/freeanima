import { useEffect, useMemo, useState } from "react";

import type { AppNavItem } from "./app-nav-i18n.ts";
import {
  layoutAppBottomNav,
  readAppBottomNavSafeAreaHorizontalPx,
  readAppBottomNavViewportWidthPx,
  type AppBottomNavDensity,
} from "./app-bottom-nav-layout.ts";

export function useAppBottomNavLayout(items: AppNavItem[]): {
  bar: AppNavItem[];
  more: AppNavItem[];
  density: AppBottomNavDensity;
} {
  const [viewportWidth, setViewportWidth] = useState(readAppBottomNavViewportWidthPx);
  const [safeAreaHorizontal, setSafeAreaHorizontal] = useState(
    readAppBottomNavSafeAreaHorizontalPx,
  );

  useEffect(() => {
    const sync = () => {
      setViewportWidth(readAppBottomNavViewportWidthPx());
      setSafeAreaHorizontal(readAppBottomNavSafeAreaHorizontalPx());
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return useMemo(
    () => layoutAppBottomNav(items, viewportWidth, safeAreaHorizontal),
    [items, safeAreaHorizontal, viewportWidth],
  );
}
