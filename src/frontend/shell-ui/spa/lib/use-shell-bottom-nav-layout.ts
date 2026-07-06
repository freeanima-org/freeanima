import { useEffect, useMemo, useState } from "react";

import type { ShellNavItem } from "./shell-nav-i18n.ts";
import {
  layoutShellBottomNav,
  readShellBottomNavSafeAreaHorizontalPx,
  readShellBottomNavViewportWidthPx,
} from "./shell-bottom-nav-layout.ts";

export function useShellBottomNavLayout(items: ShellNavItem[]): {
  bar: ShellNavItem[];
  more: ShellNavItem[];
} {
  const [viewportWidth, setViewportWidth] = useState(readShellBottomNavViewportWidthPx);
  const [safeAreaHorizontal, setSafeAreaHorizontal] = useState(
    readShellBottomNavSafeAreaHorizontalPx,
  );

  useEffect(() => {
    const sync = () => {
      setViewportWidth(readShellBottomNavViewportWidthPx());
      setSafeAreaHorizontal(readShellBottomNavSafeAreaHorizontalPx());
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return useMemo(
    () => layoutShellBottomNav(items, viewportWidth, safeAreaHorizontal),
    [items, safeAreaHorizontal, viewportWidth],
  );
}
