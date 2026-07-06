/** 终端能力：主输入范式（与视口布局断点正交） */

export type PrimaryInputKind = "pointer" | "touch";

function readFinePointerFromMedia(): boolean {
  if (typeof window === "undefined") return true;
  const fine = window.matchMedia("(pointer: fine)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;
  return fine && hover;
}

function readShellPrimaryInput(): PrimaryInputKind | null {
  const shell = typeof window !== "undefined" ? window.satelliteShell : undefined;
  const explicit = (shell as { primaryInput?: PrimaryInputKind } | undefined)?.primaryInput;
  if (explicit === "pointer" || explicit === "touch") return explicit;
  if (shell?.isElectron) return "pointer";
  if (shell?.isNativeShell && !shell.isElectron) return "touch";
  return null;
}

/**
 * 主输入是否为精确指针（鼠标/触控板）。
 * 与 `useLayoutMode()` / 视口宽度无关——iPad 宽屏仍为 touch；Electron 窄窗仍为 pointer。
 */
export function hasFinePointerCapability(): boolean {
  if (typeof window === "undefined") return false;
  const fromShell = readShellPrimaryInput();
  if (fromShell === "pointer") return true;
  if (fromShell === "touch") return false;
  return readFinePointerFromMedia();
}

/** @deprecated 使用 `hasFinePointerCapability` */
export const hasDesktopPointerCapability = hasFinePointerCapability;

export function hasTouchPrimaryCapability(): boolean {
  return !hasFinePointerCapability();
}
