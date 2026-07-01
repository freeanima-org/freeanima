import { useEffect, useState } from "react";

import { useDrawerNav } from "./viewport.ts";

/** 三栏并列断点（与 Tailwind xl 一致） */
export const THREE_COLUMN_WIDE_MQ = "(min-width: 1280px)";

export type ThreeColumnLayoutMode = "compact" | "medium" | "wide";

export function isThreeColumnWideViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(THREE_COLUMN_WIDE_MQ).matches;
}

/** compact：清单/邮箱 drawer；medium：左栏常驻 + 详情右侧抽屉；wide：三栏并列 */
export function useThreeColumnLayoutMode(): ThreeColumnLayoutMode {
  const useDrawer = useDrawerNav();
  const [wide, setWide] = useState(() => isThreeColumnWideViewport());

  useEffect(() => {
    const mq = window.matchMedia(THREE_COLUMN_WIDE_MQ);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (useDrawer) return "compact";
  if (wide) return "wide";
  return "medium";
}
