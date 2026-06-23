import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { satelliteInstancePath } from "./paths.ts";

export function registerInstanceStoreIpc(): void {
  ipcMain.handle("shell:instance-load", (_event, appId: string) => {
    const path = satelliteInstancePath(appId);
    if (!existsSync(path)) return null;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as { instance_id?: string };
      return raw.instance_id?.trim() || null;
    } catch {
      return null;
    }
  });

  ipcMain.handle("shell:instance-save", (_event, appId: string, instanceId: string) => {
    const path = satelliteInstancePath(appId);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ instance_id: instanceId.trim() }, null, 2), "utf-8");
  });
}
