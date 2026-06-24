import { BrowserWindow } from "electron";

const DOCKED_DEVTOOLS_MODE = "bottom" as const;

function toggleDockedDevTools(win: BrowserWindow): void {
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools();
  } else {
    win.webContents.openDevTools({ mode: DOCKED_DEVTOOLS_MODE });
  }
}

/** F12 切换内嵌 DevTools；开发包或未打包时默认打开 */
export function attachWindowDevTools(win: BrowserWindow, opts?: { openOnReady?: boolean }): void {
  const openOnReady = opts?.openOnReady ?? false;
  win.webContents.on("before-input-event", (event, input) => {
    if (input.type === "keyDown" && input.key === "F12") {
      toggleDockedDevTools(win);
      event.preventDefault();
    }
  });
  if (openOnReady) {
    win.webContents.once("did-finish-load", () => {
      if (!win.isDestroyed()) {
        win.webContents.openDevTools({ mode: DOCKED_DEVTOOLS_MODE });
      }
    });
  }
}
