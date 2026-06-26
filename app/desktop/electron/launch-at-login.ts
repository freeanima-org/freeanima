import { app } from "electron";

import { readLaunchAtLoginFromStore, saveLaunchAtLoginToStore } from "./shell-scoped-prefs.ts";

function updateOsLoginItem(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    ...(process.platform === "darwin" ? { openAsHidden: true } : {}),
  });
}

export function readLaunchAtLogin(): boolean {
  return readLaunchAtLoginFromStore();
}

export function setLaunchAtLogin(enabled: boolean): void {
  saveLaunchAtLoginToStore(enabled);
  updateOsLoginItem(enabled);
}

export function syncLaunchAtLoginFromStore(): void {
  updateOsLoginItem(readLaunchAtLoginFromStore());
}
