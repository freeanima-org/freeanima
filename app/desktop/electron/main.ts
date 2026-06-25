import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from "electron";
import type { Server } from "node:http";
import { join } from "node:path";

import {
  SHELL_MAIN_WINDOW,
  SHELL_STATIC_PORT,
  SHELL_STATIC_PORT_ATTEMPTS,
} from "../src/shell-profile.ts";
import {
  startCompanionServer,
  type CompanionServerHandle,
} from "@freeanima/satellite-companion/desktop";

import {
  effectiveCompanionClickthrough,
  registerCompanionHostIpc,
  startCompanionCursorPoll,
} from "./companion-host.ts";
import { registerInstanceStoreIpc } from "./instance-store-ipc.ts";
import { attachWindowDevTools } from "./devtools.ts";
import { logLine } from "./log.ts";
import { defaultHubUrl } from "./paths.ts";
import { readShellClientConfig } from "./shell-client-store.ts";
import { registerShellClientIpc } from "./shell-client-ipc.ts";
import { startShellStaticServer } from "./static-server.ts";

const SHELL_ROOT = join(__dirname, "..");

let mainWindow: BrowserWindow | null = null;
let companionWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverHandle: CompanionServerHandle | null = null;
let shellStaticServer: Server | null = null;
let shellStaticUrl = "";

let clickthrough = false;
let pointerActive = false;
let quitInProgress = false;

async function releaseInstallLocks(): Promise<void> {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.removeAllListeners();
    win.destroy();
  }
  mainWindow = null;
  companionWindow = null;
  if (tray) {
    tray.destroy();
    tray = null;
  }
  const closeServers = Promise.all([
    serverHandle?.close() ?? Promise.resolve(),
    new Promise<void>((resolve) => {
      if (shellStaticServer) shellStaticServer.close(() => resolve());
      else resolve();
    }),
  ]);
  await Promise.race([closeServers, new Promise<void>((resolve) => setTimeout(resolve, 2000))]);
  serverHandle = null;
  shellStaticServer = null;
}

function resolveHubClient(): { hubUrl: string; remoteAuthToken: string } {
  const saved = readShellClientConfig();
  if (saved) {
    return { hubUrl: saved.hubUrl, remoteAuthToken: saved.remoteAuthToken };
  }
  return { hubUrl: defaultHubUrl(), remoteAuthToken: "" };
}

function syncHubEnv(client: { hubUrl: string; remoteAuthToken: string }): void {
  process.env.FREEANIMA_URL = client.hubUrl;
  if (client.remoteAuthToken) {
    process.env.FREEANIMA_REMOTE_AUTH_TOKEN = client.remoteAuthToken;
  } else {
    delete process.env.FREEANIMA_REMOTE_AUTH_TOKEN;
  }
}

let hubClient = resolveHubClient();
syncHubEnv(hubClient);

const devToolsOnStart = !app.isPackaged || process.env.DESKTOP_SHELL_DEVTOOLS === "1";

function shellUiDistDir(): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "vendor", "shell-ui", "dist");
  }
  return join(SHELL_ROOT, "..", "..", "packages", "shell-ui", "dist");
}

function companionDistDir(): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "vendor", "companion", "dist");
  }
  return join(SHELL_ROOT, "..", "..", "satellites", "companion", "dist");
}

function preloadPath(): string {
  return join(app.getAppPath(), "electron-dist", "preload.cjs");
}

function iconPath(name: string): string {
  return join(SHELL_ROOT, "electron", "icons", name);
}

function shellArgs(extra: string[]): string[] {
  const args = [`--hub-url=${hubClient.hubUrl}`];
  if (hubClient.remoteAuthToken) {
    args.push(`--remote-auth-token=${hubClient.remoteAuthToken}`);
  }
  return [...args, ...extra];
}

function configureCompanionRuntimePaths(): void {
  const companionRoot = app.isPackaged
    ? join(app.getAppPath(), "vendor", "companion")
    : join(SHELL_ROOT, "..", "..", "satellites", "companion");
  process.env.COMPANION_PACKAGE_ROOT = companionRoot;
  if (app.isPackaged) {
    process.env.COMPANION_RESOURCES_PATH = process.resourcesPath;
    process.env.COMPANION_BIN_DIR = join(process.resourcesPath, "bin");
    return;
  }
  process.env.COMPANION_BIN_DIR = join(companionRoot, "node_modules", "fbx2vrma-converter");
}

function applyClickthrough(win: BrowserWindow): void {
  const ignore = effectiveCompanionClickthrough(clickthrough, pointerActive);
  win.setIgnoreMouseEvents(ignore, { forward: true });
}

function reloadHubClientAndMainWindow(): void {
  hubClient = resolveHubClient();
  syncHubEnv(hubClient);
  broadcast("shell:config-changed");
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, ...args);
    }
  }
}

function clearOverlayTitle(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  win.setTitle("");
}

function redrawOverlayOnWin32Blur(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  clearOverlayTitle(win);
  const [w, h] = win.getSize();
  win.setSize(w, h + 1);
  win.setSize(w, h);
}

function attachOverlayTitleGuards(win: BrowserWindow): void {
  const { webContents } = win;
  win.on("page-title-updated", (event) => {
    event.preventDefault();
    clearOverlayTitle(win);
  });
  webContents.on("did-finish-load", () => clearOverlayTitle(win));
  webContents.on("did-navigate-in-page", () => clearOverlayTitle(win));
  win.on("focus", () => clearOverlayTitle(win));
  win.on("blur", () => {
    clearOverlayTitle(win);
    if (process.platform === "win32") redrawOverlayOnWin32Blur(win);
  });
}

function companionApiOrigin(): string {
  if (!serverHandle) throw new Error("companion sidecar not started");
  return serverHandle.url;
}

function createShellBrowserWindow(opts: {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  path: string;
}): BrowserWindow {
  if (!shellStaticUrl) throw new Error("shell static server not started");
  const win = new BrowserWindow({
    width: opts.width,
    height: opts.height,
    minWidth: opts.minWidth,
    minHeight: opts.minHeight,
    show: false,
    center: true,
    autoHideMenuBar: true,
    title: opts.title,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: shellArgs([`--companion-api-origin=${companionApiOrigin()}`]),
    },
  });
  void win.loadURL(`${shellStaticUrl}${opts.path}`);
  attachWindowDevTools(win, { openOnReady: devToolsOnStart });
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  return win;
}

function openMainWindow(path = "/chat"): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    const target = `${shellStaticUrl}${path}`;
    if (mainWindow.webContents.getURL() !== target) {
      void mainWindow.loadURL(target);
    }
    return;
  }
  mainWindow = createShellBrowserWindow({
    ...SHELL_MAIN_WINDOW,
    path,
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openSettingsWindow(): void {
  openMainWindow("/settings");
}

function createCompanionOverlay(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 160,
    height: 260,
    transparent: true,
    frame: false,
    thickFrame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    hasShadow: false,
    show: false,
    title: "",
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: shellArgs([
        `--companion-api-origin=${url}`,
        "--companion-window=overlay",
      ]),
    },
  });
  attachOverlayTitleGuards(win);
  void win.loadURL(`${url}/?view=overlay`);
  win.once("ready-to-show", () => {
    clearOverlayTitle(win);
    win.show();
    win.focus();
  });
  startCompanionCursorPoll(() => companionWindow, applyClickthrough);
  return win;
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
  tray.setToolTip("FreeAnima Desktop");
  const menu = Menu.buildFromTemplate([
    { label: "打开主窗口", click: () => openMainWindow() },
    { label: "显示/隐藏伴侣", click: () => toggleCompanionVisibility() },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => openMainWindow());
}

async function startCompanionSidecar(): Promise<CompanionServerHandle> {
  return startCompanionServer({
    port: Number(process.env.SATELLITE_PORT ?? 4176),
    distDir: companionDistDir(),
    announce: false,
  });
}

async function startShellStatic(): Promise<void> {
  const dist = shellUiDistDir();
  const { server, url, port } = await startShellStaticServer(
    dist,
    SHELL_STATIC_PORT,
    SHELL_STATIC_PORT_ATTEMPTS,
  );
  shellStaticServer = server;
  shellStaticUrl = url;
  if (port !== SHELL_STATIC_PORT) {
    logLine(`shell-ui static port ${SHELL_STATIC_PORT} in use, using ${port}`);
  }
}

async function bootstrap(): Promise<void> {
  configureCompanionRuntimePaths();
  logLine("desktop-shell main enter");

  registerInstanceStoreIpc();
  registerShellClientIpc(openSettingsWindow, reloadHubClientAndMainWindow);
  registerCompanionHostIpc(
    {
      getCompanionWindow: () => companionWindow,
      getSettingsWindow: () => mainWindow,
    },
    {
      setClickthrough: (ignore) => {
        clickthrough = ignore;
        if (companionWindow && !companionWindow.isDestroyed()) applyClickthrough(companionWindow);
      },
      setPointerActive: (active) => {
        pointerActive = active;
        if (companionWindow && !companionWindow.isDestroyed()) applyClickthrough(companionWindow);
      },
      toggleCompanionVisibility,
      broadcast,
    },
  );

  try {
    serverHandle = await startCompanionSidecar();
    await startShellStatic();
    logLine(
      `companion server ${serverHandle.url}; shell-ui ${shellStaticUrl}; hub ${hubClient.hubUrl}`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logLine(`startup failed: ${msg}`);
    dialog.showErrorBox(
      "FreeAnima Desktop",
      `启动失败：${msg}\n\n日志：~/.anima/desktop-shell/shell.log`,
    );
    app.quit();
    return;
  }

  Menu.setApplicationMenu(null);
  if (process.platform === "win32") {
    app.on("browser-window-blur", () => {
      if (companionWindow && !companionWindow.isDestroyed())
        redrawOverlayOnWin32Blur(companionWindow);
    });
  }

  companionWindow = createCompanionOverlay(serverHandle.url);
  createTray();
  if (!readShellClientConfig()) {
    openSettingsWindow();
  } else {
    openMainWindow();
  }
  logLine("desktop-shell setup complete");
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("window-all-closed", () => {
  // 托盘应用：窗口全关也不退出，除非正在安装/更新或用户主动退出
});

app.on("before-quit", (event) => {
  if (quitInProgress) return;
  event.preventDefault();
  quitInProgress = true;
  void releaseInstallLocks().finally(() => {
    app.exit(0);
  });
});

process.on("uncaughtException", (error) => {
  logLine(`uncaughtException: ${error.stack ?? error.message}`);
});

process.on("unhandledRejection", (reason) => {
  logLine(`unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
