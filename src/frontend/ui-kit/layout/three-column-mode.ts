import { useEffect, useState } from "react";

import {
  isMobileLayoutViewport,
  isThreeColumnWideViewport,
  MOBILE_LAYOUT_MQ,
  THREE_COLUMN_WIDE_MQ,
} from "./viewport.ts";

export type ThreeColumnLayoutMode = "compact" | "medium" | "wide";

export function readThreeColumnLayoutMode(): ThreeColumnLayoutMode {
  if (isMobileLayoutViewport()) return "compact";
  if (isThreeColumnWideViewport()) return "wide";
  return "medium";
}

/** <768 compact；768–1027 桌面两列；≥1028 三栏并列 */
export function useThreeColumnLayoutMode(): ThreeColumnLayoutMode {
  const [mode, setMode] = useState<ThreeColumnLayoutMode>(() => readThreeColumnLayoutMode());

  useEffect(() => {
    const mobileMq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const wideMq = window.matchMedia(THREE_COLUMN_WIDE_MQ);
    const sync = () => setMode(readThreeColumnLayoutMode());
    sync();
    mobileMq.addEventListener("change", sync);
    wideMq.addEventListener("change", sync);
    return () => {
      mobileMq.removeEventListener("change", sync);
      wideMq.removeEventListener("change", sync);
    };
  }, []);

  return mode;
}
