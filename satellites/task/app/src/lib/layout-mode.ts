import { useEffect, useState } from "react";

import { useDrawerNav } from "@freeanima/ui-kit/layout";

/** 三栏并列断点（与 Tailwind xl 一致） */
export const TASK_WIDE_LAYOUT_MQ = "(min-width: 1280px)";

export type TaskLayoutMode = "compact" | "medium" | "wide";

export function isTaskWideLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(TASK_WIDE_LAYOUT_MQ).matches;
}

export function useTaskLayoutMode(): TaskLayoutMode {
  const useDrawer = useDrawerNav();
  const [wide, setWide] = useState(() => isTaskWideLayoutViewport());

  useEffect(() => {
    const mq = window.matchMedia(TASK_WIDE_LAYOUT_MQ);
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  if (useDrawer) return "compact";
  if (wide) return "wide";
  return "medium";
}
