import { app, BrowserWindow, dialog, Menu, nativeImage, Tray } from "electron";
import type { Server } from "node:http";
import { join } from "node:path";

import {
  CHAMBER_STATIC_PORT,
  CHAMBER_STATIC_PORT_ATTEMPTS,
} from "@freeanima/frontend-chamber/desktop";
import { resolveHubWsUrl } from "@freeanima/sap-contract";
import {
  companionSettingsWindowSizeWin,
  startCompanionServer,
  type CompanionServerHandle,
} from "@freeanima/satellite-companion/desktop";
import { CHAT_STATIC_PORT, CHAT_STATIC_PORT_ATTEMPTS } from "@freeanima/satellite-chat/desktop";

import {
  effectiveCompanionClickthrough,
  registerCompanionHostIpc,
  startCompanionCursorPoll,
} from "./companion-host.ts";
import { registerInstanceStoreIpc } from "./instance-store-ipc.ts";
import { logLine } from "./log.ts";
import { defaultHubUrl } from "./paths.ts";
import { startStaticServer, startWebuiStaticServer } from "./static-server.ts";

const SHELL_ROOT = join(__dirname, "..");

let companionWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let chamberWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverHandle: CompanionServerHandle | null = null;
let chatStaticServer: Server | null = null;
let chatStaticUrl = "";
let chamberStaticServer: Server | null = null;
let chamberStaticUrl = "";

let clickthrough = false;
let pointerActive = false;

const hubUrl = defaultHubUrl();

function vendorDir(name: string): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "vendor", name, "dist");
  }
  if (name === "chamber") {
    return join(SHELL_ROOT, "..", "..", "frontends", "chamber", "dist");
  }
  return join(SHELL_ROOT, "..", name, "dist");
}

function companionDistDir(): string {
  if (app.isPackaged) {
    return join(app.getAppPath(), "vendor", "companion", "dist");
  }
  return join(SHELL_ROOT, "..", "companion", "dist");
}

function preloadPath(): string {
  return join(app.getAppPath(), "electron-dist", "preload.cjs");
}

function iconPath(name: string): string {
  return join(SHELL_ROOT, "electron", "icons", name);
}

function shellArgs(extra: string[]): string[] {
  return [`--hub-url=${hubUrl}`, ...extra];
}

function configureCompanionRuntimePaths(): void {
  const companionRoot = app.isPackaged
    ? join(app.getAppPath(), "vendor", "companion")
    : join(SHELL_ROOT, "..", "companion");
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

function createCompanionWindow(url: string): BrowserWindow {
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

function settingsWindowSize(): { width: number; height: number } {
  if (process.platform === "win32") {
    return companionSettingsWindowSizeWin();
  }
  return { width: 840, height: 720 };
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
      additionalArguments: shellArgs([
        `--companion-api-origin=${url}`,
        "--companion-window=settings",
      ]),
    },
  });
  void win.loadURL(`${url}/?view=settings`);
  return win;
}

function createChatWindow(url: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 720,
    minWidth: 640,
    minHeight: 480,
    show: false,
    center: true,
    autoHideMenuBar: true,
    title: "FreeAnima 会客厅",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: shellArgs([]),
    },
  });
  void win.loadURL(url);
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
  return win;
}

function createChamberWindow(): BrowserWindow {
  if (!chamberStaticUrl) {
    throw new Error("chamber static server not started");
  }
  const url = `${chamberStaticUrl}/webui/chamber/dashboard?embed=1`;
  const win = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 720,
    minHeight: 560,
    show: false,
    center: true,
    autoHideMenuBar: true,
    title: "FreeAnima 卧室",
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      additionalArguments: shellArgs([]),
    },
  });
  void win.loadURL(url);
  win.once("ready-to-show", () => {
    win.show();
    win.focus();
  });
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

function openChatWindow(): void {
  if (chatWindow && !chatWindow.isDestroyed()) {
    chatWindow.show();
    chatWindow.focus();
    return;
  }
  if (!chatStaticUrl) {
    throw new Error("chat static server not started");
  }
  chatWindow = createChatWindow(chatStaticUrl);
}

function openChamberWindow(): void {
  if (chamberWindow && !chamberWindow.isDestroyed()) {
    chamberWindow.show();
    chamberWindow.focus();
    return;
  }
  chamberWindow = createChamberWindow();
}

function createTray(): void {
  const icon = nativeImage.createFromPath(iconPath("32x32.png"));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("FreeAnima Desktop");
  const menu = Menu.buildFromTemplate([
    {
      label: "显示/隐藏伴侣",
      click: () => toggleCompanionVisibility(),
    },
    {
      label: "会客厅…",
      click: () => openChatWindow(),
    },
    {
      label: "卧室…",
      click: () => openChamberWindow(),
    },
    {
      label: "伴侣设置…",
      click: () => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.show();
          settingsWindow.focus();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit(),
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

async function startCompanionSidecar(): Promise<CompanionServerHandle> {
  return startCompanionServer({
    port: Number(process.env.SATELLITE_PORT ?? 4176),
    distDir: companionDistDir(),
    announce: false,
  });
}

async function startChatStatic(): Promise<void> {
  const dist = vendorDir("chat");
  const { server, url, port } = await startStaticServer(
    dist,
    CHAT_STATIC_PORT,
    CHAT_STATIC_PORT_ATTEMPTS,
    { appId: "chat", hubWsUrl: resolveHubWsUrl(hubUrl) },
  );
  chatStaticServer = server;
  chatStaticUrl = url;
  if (port !== CHAT_STATIC_PORT) {
    logLine(`chat static port ${CHAT_STATIC_PORT} in use, using ${port}`);
  }
}

async function startChamberStatic(): Promise<void> {
  const dist = vendorDir("chamber");
  const { server, url, port } = await startWebuiStaticServer(
    dist,
    CHAMBER_STATIC_PORT,
    CHAMBER_STATIC_PORT_ATTEMPTS,
  );
  chamberStaticServer = server;
  chamberStaticUrl = url;
  if (port !== CHAMBER_STATIC_PORT) {
    logLine(`chamber static port ${CHAMBER_STATIC_PORT} in use, using ${port}`);
  }
}

async function bootstrap(): Promise<void> {
  configureCompanionRuntimePaths();
  logLine("desktop-shell main enter");

  registerInstanceStoreIpc();
  registerCompanionHostIpc(
    {
      getCompanionWindow: () => companionWindow,
      getSettingsWindow: () => settingsWindow,
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
    await startChatStatic();
    await startChamberStatic();
    logLine(
      `companion server ${serverHandle.url}; chat static ${chatStaticUrl}; chamber static ${chamberStaticUrl}; hub ${hubUrl}`,
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

  companionWindow = createCompanionWindow(serverHandle.url);
  settingsWindow = createSettingsWindow(serverHandle.url);
  createTray();
  logLine("desktop-shell setup complete");
}

app.whenReady().then(() => {
  void bootstrap();
});

app.on("window-all-closed", () => {
  // 托盘应用
});

app.on("before-quit", () => {
  void serverHandle?.close();
  chatStaticServer?.close();
  chamberStaticServer?.close();
});

process.on("uncaughtException", (error) => {
  logLine(`uncaughtException: ${error.stack ?? error.message}`);
});

process.on("unhandledRejection", (reason) => {
  logLine(`unhandledRejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});
