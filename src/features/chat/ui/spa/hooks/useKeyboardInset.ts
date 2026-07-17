import { Keyboard } from "@capacitor/keyboard";
import { isCapacitorNativePlatform } from "@freeanima/frontend/shell-sdk/capacitor-runtime";
import { getShellKind } from "@freeanima/frontend/shell-sdk/shell-runtime.ts";
import { useEffect, useState } from "react";

import {
  computeLayoutShrink,
  computeVisualViewportInset,
  mergeKeyboardInset,
} from "@freeanima/features/chat/ui/spa/lib/keyboard-inset.ts";

function readInnerHeight(): number {
  return typeof window !== "undefined" ? window.innerHeight : 0;
}

function shouldListenNativeKeyboard(): boolean {
  return getShellKind() === "capacitor" && isCapacitorNativePlatform();
}

/** 虚拟键盘 inset；壳适配在 hook 内自判，调用方不传壳 flag */
export function useKeyboardInset(): number {
  const [vvInset, setVvInset] = useState(0);
  const [nativeHeight, setNativeHeight] = useState(0);
  const [baselineInnerHeight, setBaselineInnerHeight] = useState(readInnerHeight);
  const [innerHeight, setInnerHeight] = useState(readInnerHeight);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setInnerHeight(readInnerHeight());
      setVvInset(computeVisualViewportInset(vv));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!shouldListenNativeKeyboard()) return;
    let showListener: { remove: () => Promise<void> } | undefined;
    let hideListener: { remove: () => Promise<void> } | undefined;
    void (async () => {
      showListener = await Keyboard.addListener("keyboardDidShow", (info) => {
        setNativeHeight(info.keyboardHeight);
      });
      hideListener = await Keyboard.addListener("keyboardDidHide", () => {
        setNativeHeight(0);
        const height = readInnerHeight();
        setBaselineInnerHeight(height);
        setInnerHeight(height);
      });
    })();
    return () => {
      void showListener?.remove();
      void hideListener?.remove();
    };
  }, []);

  const layoutShrink = computeLayoutShrink(baselineInnerHeight, innerHeight);
  return mergeKeyboardInset(vvInset, nativeHeight, layoutShrink);
}
