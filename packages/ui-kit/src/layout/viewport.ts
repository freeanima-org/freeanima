import { useEffect, useState } from "react";

/** 与 Chat / Task / Admin 侧栏断点一致 */
export const MOBILE_LAYOUT_MQ = "(max-width: 1023px)";

export function isNativeShell(): boolean {
  return typeof window !== "undefined" && Boolean(window.satelliteShell?.isNativeShell);
}

export function isMobileLayoutViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_MQ).matches;
}

/** 窄视口布局（≤1023px） */
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

/** 原生壳或窄视口：list 栏用 drawer；否则 PC 并列常驻 */
export function useDrawerNav(): boolean {
  return isNativeShell() || useMobileLayout();
}
