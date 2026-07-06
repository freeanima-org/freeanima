import { useEffect, useState } from "react";

import { hasFinePointerCapability } from "./shell-capability.ts";

/** 精确指针能力（右键菜单）；与视口布局正交 */
export function useFinePointerCapability(): boolean {
  const [fine, setFine] = useState(() => hasFinePointerCapability());

  useEffect(() => {
    const sync = () => setFine(hasFinePointerCapability());
    sync();
    const mqFine = window.matchMedia("(pointer: fine)");
    const mqHover = window.matchMedia("(hover: hover)");
    mqFine.addEventListener("change", sync);
    mqHover.addEventListener("change", sync);
    return () => {
      mqFine.removeEventListener("change", sync);
      mqHover.removeEventListener("change", sync);
    };
  }, []);

  return fine;
}

/** 触摸主输入（ActionSheet / 长按）；与视口布局正交 */
export function useTouchPrimaryCapability(): boolean {
  const fine = useFinePointerCapability();
  return !fine;
}

/** @deprecated 使用 `useFinePointerCapability` */
export const useDesktopPointerCapability = useFinePointerCapability;

/** 是否启用右键 ContextMenu（`hasFinePointerCapability` 的 React 封装） */
export function useContextMenuCapability(): boolean {
  return useFinePointerCapability();
}

/** 是否以 ActionSheet / 长按替代右键（`hasTouchPrimaryCapability` 的 React 封装） */
export function useActionSheetCapability(): boolean {
  return useTouchPrimaryCapability();
}
