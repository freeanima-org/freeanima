import { useEffect, useState } from "react";

import { hasEnterToSendCapability, hasFinePointerCapability } from "./shell-capability.ts";
import { canOpenHabitatSettings, getShellKind, type ShellRuntimeKind } from "./shell-runtime.ts";

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

/** 是否启用右键 ContextMenu（`hasFinePointerCapability` 的 React 封装） */
export function useContextMenuCapability(): boolean {
  return useFinePointerCapability();
}

/** 是否以 ActionSheet / 长按替代右键（`hasTouchPrimaryCapability` 的 React 封装） */
export function useActionSheetCapability(): boolean {
  return useTouchPrimaryCapability();
}

/** Enter 发送（pointer）vs 换行（touch）；与布局/壳正交 */
export function useEnterToSendCapability(): boolean {
  const [enterToSend, setEnterToSend] = useState(() => hasEnterToSendCapability());

  useEffect(() => {
    const sync = () => setEnterToSend(hasEnterToSendCapability());
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

  return enterToSend;
}

/** 壳子维 kind（web / tauri） */
export function useShellKind(): ShellRuntimeKind {
  const [kind, setKind] = useState(() => getShellKind());

  useEffect(() => {
    setKind(getShellKind());
  }, []);

  return kind;
}

/** 是否展示「打开 连接设置」 */
export function useOpenHabitatSettingsCapability(): boolean {
  const [open, setOpen] = useState(() => canOpenHabitatSettings());

  useEffect(() => {
    setOpen(canOpenHabitatSettings());
  }, []);

  return open;
}
