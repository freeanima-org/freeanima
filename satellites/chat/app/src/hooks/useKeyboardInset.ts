import { Keyboard } from "@capacitor/keyboard";
import { useEffect, useState } from "react";

import {
  computeLayoutShrink,
  computeVisualViewportInset,
  mergeKeyboardInset,
} from "@/lib/keyboard-inset.ts";

function readInnerHeight(): number {
  return typeof window !== "undefined" ? window.innerHeight : 0;
}

export function useKeyboardInset(nativeShell: boolean): number {
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
    if (!nativeShell) return;
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
  }, [nativeShell]);

  const layoutShrink = computeLayoutShrink(baselineInnerHeight, innerHeight);
  return mergeKeyboardInset(vvInset, nativeHeight, layoutShrink);
}
