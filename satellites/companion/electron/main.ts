import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, screen, Tray } from "electron";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { logLine } from "./log.ts";
import { startCompanionServer, type CompanionServerHandle } from "../server/index.ts";
import {
  COMPANION_WINDOW_HEIGHT,
  COMPANION_WINDOW_WIDTH,
  SETTINGS_WINDOW_HEIGHT,
  SETTINGS_WINDOW_HEIGHT_WIN,
  SETTINGS_WINDOW_WIDTH,
  SETTINGS_WINDOW_WIDTH_WIN,
  SATELLITE_PORT_START,
} from "../shared/constants.ts";
import type { PatrolScreenInfo } from "./types.ts";

const MAIN_DIR = dirname(fileURLToPath(import.meta.url));
const COMPANION_ROOT = join(MAIN_DIR, "..");

let companionWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverHandle: CompanionServerHandle | null = null;

let clickthrough = false;
let pointerActive = false;

function companionDistDir(): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "dist");
  }
  return join(COMPANION_ROOT, "dist");
}

function preloadPath(): string {
  return join(app.getAppPath(), "electron-dist", "preload.cjs");
}

function iconPath(name: string): string {
  return join(COMPANION_ROOT, "electron", "icons", name);
}

function configureRuntimePaths(): void {
  if (app.isPackaged) {
    process.env.COMPANION_RESOURCES_PATH = process.resourcesPath;
    process.env.COMPANION_BIN_DIR = join(process.resourcesPath, "bin");
    return;
  }
  process.env.COMPANION_BIN_DIR = join(COMPANION_ROOT, "node_modules", "fbx2vrma-converter");
}

function effectiveClickthrough(ignore: boolean): boolean {
  if (pointerActive) return false;
  if (process.platform === "win32") return false;
  return ignore;
}

function applyClickthrough(win: BrowserWindow): void {
  const ignore = effectiveClickthrough(clickthrough);
  win.setIgnoreMouseEvents(ignore, { forward: true });
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

function createCompanionWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: COMPANION_WINDOW_WIDTH,
    height: COMPANION_WINDOW_HEIGHT,
    transparent: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    show: false,
    title: "",
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--companion-api-origin=${url}`, "--companion-window=overlay"],
    },
  });

  // Windows 无边框窗仍会把 document.title 渲染成顶部标题条，须拦截
  win.on("page-title-updated", (event) => {
    event.preventDefault();
    win.setTitle("");
  });

  process.env.COMPANION_API_ORIGIN = url;
  void win.loadURL(`${url}/?view=overlay`);
  win.once("ready-to-show", () => {
    win.setTitle("");
    win.show();
    win.focus();
  });

  startCursorPoll(win);
  return win;
}

function settingsWindowSize(): { width: number; height: number } {
  if (process.platform === "win32") {
    return { width: SETTINGS_WINDOW_WIDTH_WIN, height: SETTINGS_WINDOW_HEIGHT_WIN };
  }
  return { width: SETTINGS_WINDOW_WIDTH, height: SETTINGS_WINDOW_HEIGHT };
}

function createSettingsWindow(url: string): BrowserWindow {
  const { width, height } = settingsWindowSize();
  const win = new BrowserWindow({
    width,
    height,
    minWidth: width,
    minHeight: Math.round(height * 0.75),
    show: false,
    center: true,
    autoHideMenuBar: true,
    title: "FreeAnima Companion 设置",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: [`--companion-api-origin=${url}`, "--companion-window=settings"],
    },
  });

  void win.loadURL(`${url}/?view=settings`);
  return win;
}

function startCursorPoll(win: BrowserWindow): void {
  const timer = setInterval(() => {
    if (win.isDestroyed()) {
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

function registerIpc(): void {
  ipcMain.handle("shell:set-clickthrough", (_event, ignore: boolean) => {
    clickthrough = ignore;
    if (companionWindow && !companionWindow.isDestroyed()) {
      applyClickthrough(companionWindow);
    }
  });

  ipcMain.handle("shell:set-pointer-active", (_event, active: boolean) => {
    pointerActive = active;
    if (companionWindow && !companionWindow.isDestroyed()) {
      applyClickthrough(companionWindow);
    }
  });

  ipcMain.handle("shell:move-window", (_event, x: number, y: number) => {
    if (!companionWindow || companionWindow.isDestroyed()) return;
    companionWindow.setPosition(Math.round(x), Math.round(y));
  });

  ipcMain.handle("shell:get-patrol-screen", (): PatrolScreenInfo => {
    if (!companionWindow || companionWindow.isDestroyed()) {
      throw new Error("companion window not found");
    }
    const bounds = companionWindow.getBounds();
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
    if (!companionWindow || companionWindow.isDestroyed()) {
      return { x: 0, y: 0 };
    }
    const [x, y] = companionWindow.getPosition();
    return { x, y };
  });

  ipcMain.handle("shell:start-drag", () => {
    if (!companionWindow || companionWindow.isDestroyed()) return;
    if (process.platform === "darwin") {
      companionWindow.moveTop();
    }
  });

  ipcMain.handle("shell:open-settings", () => {
    if (!settingsWindow || settingsWindow.isDestroyed()) {
      throw new Error("settings window not found");
    }
    settingsWindow.show();
    settingsWindow.focus();
  });

  ipcMain.handle("shell:emit-config-changed", () => {
    broadcast("shell:config-changed");
  });

  ipcMain.handle("shell:toggle-companion-visibility", () => toggleCompanionVisibility());
}

function toggleCompanionVisibility(): boolean {
  if (!companionWindow || companionWindow.isDestroyed()) {
    throw new Error("companion window not found");
  }
  if (companionWindow.isVisible()) {
    companionWindow.hide();
    return false;
  }
  companionWindow.show();
  companionWindow.focus();
  return true;
}

function createTray(): void {
  const icon = nativeImage.createFromPath(iconPath("32x32.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("FreeAnima Companion");
  const menu = Menu.buildFromTemplate([
    {
      label: "显示/隐藏伴侣",
      click: () => {
        toggleCompanionVisibility();
      },
    },
    {
      label: "设置…",
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
          settingsWindow.focus();
        }
      },
    },
    {
      label: "退出",
      click: () => {
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (companionWindow && !companionWindow.isDestroyed()) {
      companionWindow.show();
      companionWindow.focus();
    }
  });
}

async function startServer(): Promise<CompanionServerHandle> {
  return startCompanionServer({
    port: Number(process.env.SATELLITE_PORT ?? SATELLITE_PORT_START),
    distDir: companionDistDir(),
    announce: false,
  });
}

async function bootstrap(): Promise<void> {
  configureRuntimePaths();
  logLine("companion electron main enter");

  try {
    serverHandle = await startServer();
    logLine(`companion server started at ${serverHandle.url}`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logLine(`server start failed: ${msg}`);
    dialog.showErrorBox(
      "FreeAnima Companion",
      `后台服务启动失败：${msg}\n\n日志：~/.anima/companion/shell.log`,
    );
    app.quit();
    return;
  }

  registerIpc();
  Menu.setApplicationMenu(null);
  companionWindow = createCompanionWindow(serverHandle.url);
  settingsWindow = createSettingsWindow(serverHandle.url);
  createTray();
  logLine("companion electron setup complete");
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("window-all-closed", () => {
  // 托盘应用：不因窗口关闭而退出
});

app.on("before-quit", () => {
  void serverHandle?.close();
});

process.on("uncaughtException", (error) => {
  logLine(`uncaughtException: ${error.stack ?? error.message}`);
});

process.on("unhandledRejection", (reason) => {
  logLine(`unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
