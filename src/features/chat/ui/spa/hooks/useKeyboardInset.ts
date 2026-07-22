import { getShellBuildTarget } from "@freeanima/frontend/shell-sdk/shell-build-target.ts";
import { isTauriRuntime } from "@freeanima/frontend/shell-sdk/tauri-runtime";
import { useEffect, useState } from "react";

import {
  computeLayoutShrink,
  computeVisualViewportInset,
  mergeKeyboardInset,
} from "@freeanima/features/chat/ui/spa/lib/keyboard-inset.ts";

function readInnerHeight(): number {
  return typeof window !== "undefined" ? window.innerHeight : 0;
}

/** Tauri Android / 移动 Web：依赖 visualViewport；无 Capacitor Keyboard 插件。 */
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
    if (!vv) return;
    const update = () => {
      setInnerHeight(readInnerHeight());
      setVvInset(computeVisualViewportInset(vv));
      if (shouldUseVisualViewportOnly()) {
        setBaselineInnerHeight(readInnerHeight());
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
  return mergeKeyboardInset(vvInset, 0, layoutShrink);
}
