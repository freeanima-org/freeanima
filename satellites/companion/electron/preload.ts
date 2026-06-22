import { contextBridge, ipcRenderer } from "electron";
import type { CompanionShellApi, CompanionWindowRole, PatrolScreenInfo } from "./types.ts";

const apiOriginArg = process.argv.find((value) => value.startsWith("--companion-api-origin="));
const windowRoleArg = process.argv.find((value) => value.startsWith("--companion-window="));
const apiOrigin = apiOriginArg?.slice("--companion-api-origin=".length) ?? "http://127.0.0.1:4176";
const windowRoleRaw = windowRoleArg?.slice("--companion-window=".length);
const windowRole: CompanionWindowRole = windowRoleRaw === "settings" ? "settings" : "overlay";

const shell: CompanionShellApi = {
  isElectron: true,
  windowRole,
  apiOrigin,
  setClickThrough: (ignore) => ipcRenderer.invoke("shell:set-clickthrough", ignore),
  setPointerActive: (active) => ipcRenderer.invoke("shell:set-pointer-active", active),
  moveWindow: (x, y) => ipcRenderer.invoke("shell:move-window", x, y),
  getPatrolScreen: () => ipcRenderer.invoke("shell:get-patrol-screen") as Promise<PatrolScreenInfo>,
  getWindowPosition: () => ipcRenderer.invoke("shell:get-window-position"),
  listenCursorPosition: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, pos: { x: number; y: number }) => {
      handler(pos);
    };
    ipcRenderer.on("shell:cursor-position", listener);
    return () => {
      ipcRenderer.removeListener("shell:cursor-position", listener);
    };
  },
  startWindowDrag: () => ipcRenderer.invoke("shell:start-drag"),
  openSettings: () => ipcRenderer.invoke("shell:open-settings"),
  emitConfigChanged: () => ipcRenderer.invoke("shell:emit-config-changed"),
  listenConfigChanged: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("shell:config-changed", listener);
    return () => {
      ipcRenderer.removeListener("shell:config-changed", listener);
    };
  },
  listenServerError: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => handler(message);
    ipcRenderer.on("shell:server-error", listener);
    return () => {
      ipcRenderer.removeListener("shell:server-error", listener);
    };
  },
};

contextBridge.exposeInMainWorld("companionShell", shell);
