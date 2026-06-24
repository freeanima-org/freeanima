import { BrowserWindow } from "electron";

/** F12 切换 DevTools；开发包或未打包时默认打开 */
export function attachWindowDevTools(win: BrowserWindow, opts?: { openOnReady?: boolean }): void {
  const openOnReady = opts?.openOnReady ?? false;
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  if (openOnReady) {
    win.webContents.once("did-finish-load", () => {
      if (!win.isDestroyed()) win.webContents.openDevTools({ mode: "detach" });
    });
  }
}

export function toggleDevToolsForFocusedWindow(): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win && !win.isDestroyed()) win.webContents.toggleDevTools();
}
