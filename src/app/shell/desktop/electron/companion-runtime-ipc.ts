import type { BrowserWindow } from "electron";
import { ipcMain } from "electron";

import {
  addRuntimeExternalListener,
  advanceBubble,
  bubbleState,
  runtimeWsPayload,
  type RuntimeWsMessage,
} from "@freeanima/satellites/companion/lib/exports/desktop.ts";

export const COMPANION_RUNTIME_CHANNEL = "companion:runtime";

export type CompanionRuntimeIpcHandle = {
  dispose: () => void;
};

/**
 * 将 companion runtime 广播接到 Electron IPC（overlay 不再依赖 /api/runtime/ws）。
 * browser-dev 仍走 localhost WebSocket。
 */
export function registerCompanionRuntimeIpc(
  getCompanionWindow: () => BrowserWindow | null,
): CompanionRuntimeIpcHandle {
  const removeListener = addRuntimeExternalListener((message: RuntimeWsMessage) => {
    const win = getCompanionWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(COMPANION_RUNTIME_CHANNEL, message);
  });

  ipcMain.handle("companion:bubbles-advance", () => {
    return { current: advanceBubble() };
  });

  ipcMain.handle("companion:runtime-snapshot", () => {
    return runtimeWsPayload(bubbleState(), []);
  });

  return {
    dispose: () => {
      removeListener();
      ipcMain.removeHandler("companion:bubbles-advance");
      ipcMain.removeHandler("companion:runtime-snapshot");
    },
  };
}
