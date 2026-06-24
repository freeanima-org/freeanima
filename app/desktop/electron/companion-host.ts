import type { BrowserWindow } from "electron";
import { ipcMain, screen } from "electron";

import type { PatrolScreenInfo } from "@freeanima/satellite-sdk";

export type CompanionHostState = {
  getCompanionWindow: () => BrowserWindow | null;
  getSettingsWindow: () => BrowserWindow | null;
};

export type CompanionHostHandlers = {
  setClickthrough: (ignore: boolean) => void;
  setPointerActive: (active: boolean) => void;
  toggleCompanionVisibility: () => boolean;
  broadcast: (channel: string, ...args: unknown[]) => void;
};

export function registerCompanionHostIpc(
  state: CompanionHostState,
  handlers: CompanionHostHandlers,
): void {
  ipcMain.handle("shell:set-clickthrough", (_event, ignore: boolean) => {
    handlers.setClickthrough(ignore);
  });

  ipcMain.handle("shell:set-pointer-active", (_event, active: boolean) => {
    handlers.setPointerActive(active);
  });

  ipcMain.handle("shell:move-window", (_event, x: number, y: number) => {
    const win = state.getCompanionWindow();
    if (!win || win.isDestroyed()) return;
    win.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.handle("shell:get-patrol-screen", (): PatrolScreenInfo => {
    const win = state.getCompanionWindow();
    if (!win || win.isDestroyed()) {
      throw new Error("companion window not found");
    }
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    return {
      availLeft: display.workArea.x,
      availTop: display.workArea.y,
      availWidth: display.workArea.width,
      availHeight: display.workArea.height,
      windowWidth: bounds.width,
      windowHeight: bounds.height,
    };
  });

  ipcMain.handle("shell:get-window-position", () => {
    const win = state.getCompanionWindow();
    if (!win || win.isDestroyed()) {
      return { x: 0, y: 0 };
    }
    const [x, y] = win.getPosition();
    return { x, y };
  });

  ipcMain.handle("shell:start-drag", () => {
    const win = state.getCompanionWindow();
    if (!win || win.isDestroyed()) return;
    if (process.platform === "darwin") {
      win.moveTop();
    }
  });

  ipcMain.handle("shell:emit-config-changed", () => {
    handlers.broadcast("shell:config-changed");
  });

  ipcMain.handle("shell:toggle-companion-visibility", () => handlers.toggleCompanionVisibility());
}

export function startCompanionCursorPoll(
  getCompanionWindow: () => BrowserWindow | null,
  applyClickthrough: (win: BrowserWindow) => void,
): void {
  const timer = setInterval(() => {
    const win = getCompanionWindow();
    if (!win || win.isDestroyed()) {
      clearInterval(timer);
      return;
    }
    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();
    const scale = win.webContents.getZoomFactor() || 1;
    const x = (cursor.x - bounds.x) / scale;
    const y = (cursor.y - bounds.y) / scale;
    if (!win.isDestroyed()) {
      win.webContents.send("shell:cursor-position", { x, y });
      applyClickthrough(win);
    }
  }, 16);
}

export function effectiveCompanionClickthrough(
  clickthrough: boolean,
  pointerActive: boolean,
): boolean {
  if (pointerActive) return false;
  if (process.platform === "win32") return false;
  return clickthrough;
}
