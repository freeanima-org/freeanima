import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target.ts";
import { isTauriRuntime } from "@freeanima/client/portal-sdk/tauri-runtime";
import { useEffect, useState } from "react";

import {
  computeLayoutShrink,
  computeVisualViewportInset,
  mergeKeyboardInset,
  stabilizeKeyboardInset,
} from "@freeanima/features/chat/ui/spa/lib/keyboard-inset.ts";

function readInnerHeight(): number {
  return typeof window !== "undefined" ? window.innerHeight : 0;
}

/** Tauri Android / 移动 Web：依赖 visualViewport。 */
function shouldUseVisualViewportOnly(): boolean {
  const buildTarget = getShellBuildTarget();
  return buildTarget === "mobile" || isTauriRuntime();
}

/** 虚拟键盘 inset；壳适配在 hook 内自判，调用方不传壳 flag */
export function useKeyboardInset(): number {
  const [vvInset, setVvInset] = useState(0);
  const [baselineInnerHeight, setBaselineInnerHeight] = useState(readInnerHeight);
  const [innerHeight, setInnerHeight] = useState(readInnerHeight);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return () => {};
    const update = () => {
      const nextInner = readInnerHeight();
      const nextVv = computeVisualViewportInset(vv);
      setInnerHeight((prev) => (prev === nextInner ? prev : nextInner));
      setVvInset((prev) => (prev === nextVv ? prev : nextVv));
      // VV-only：baseline 跟当前 inner，layoutShrink≈0，避免与 vvInset 双重扣减
      if (shouldUseVisualViewportOnly()) {
        setBaselineInnerHeight((prev) => (prev === nextInner ? prev : nextInner));
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  const layoutShrink = computeLayoutShrink(baselineInnerHeight, innerHeight);
  return stabilizeKeyboardInset(mergeKeyboardInset(vvInset, 0, layoutShrink));
}
