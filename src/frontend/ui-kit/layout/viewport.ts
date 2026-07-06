import { useEffect, useState } from "react";

import { windowWithSatelliteShell } from "./window-shell.ts";

/** 与 Tailwind md 对齐：compact < md，expanded ≥ md */
export const COMPACT_LAYOUT_MAX_PX = 767;
export const MOBILE_LAYOUT_MQ = `(max-width: ${COMPACT_LAYOUT_MAX_PX}px)`;
export const EXPANDED_LAYOUT_MQ = `(min-width: ${COMPACT_LAYOUT_MAX_PX + 1}px)`;

export function isNativeShell(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(windowWithSatelliteShell().satelliteShell?.isNativeShell)
  );
}

export function isMobileLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}

/** 窄视口布局（< md） */
export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(() => isMobileLayoutViewport());

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return mobile;
}

/** 窄视口：list 栏用 drawer；中宽视口并列常驻 */
export function useDrawerNav(): boolean {
  return useMobileLayout();
}
