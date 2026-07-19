import { app, ipcMain, type IpcMainInvokeEvent } from "electron";

import { logLine } from "./log.ts";
import {
  createInstallerTempPath,
  downloadInstallerToFile,
  launchWindowsNsisInstaller,
  parsePackagedUpdatePayload,
  verifyDownloadedInstaller,
} from "./packaged-update.ts";

export const PACKAGED_UPDATE_PROGRESS_CHANNEL = "shell:packaged-update-progress";

export type PackagedUpdateProgressPayload = {
  received: number;
  total: number | null;
  phase: "downloading" | "installing";
};

function sendProgress(event: IpcMainInvokeEvent, payload: PackagedUpdateProgressPayload): void {
  event.sender.send(PACKAGED_UPDATE_PROGRESS_CHANNEL, payload);
}

export function registerPackagedUpdateIpc(): void {
  ipcMain.handle("shell:apply-packaged-update", async (event, payload: unknown) => {
    try {
      const { assetUrl, expectedSize } = parsePackagedUpdatePayload(payload);
      const dest = createInstallerTempPath(app.getPath("temp"));
      logLine(`packaged-update: downloading ${assetUrl} → ${dest}`);
      await downloadInstallerToFile(assetUrl, dest, {
        ...(expectedSize != null ? { expectedSize } : {}),
        onProgress: (p) => {
          sendProgress(event, {
            received: p.received,
            total: p.total,
            phase: "downloading",
          });
        },
      });
      verifyDownloadedInstaller(dest, expectedSize);
      logLine(`packaged-update: verified installer (${expectedSize ?? "unknown"} bytes expected)`);
      sendProgress(event, {
        received: expectedSize ?? 0,
        total: expectedSize ?? null,
        phase: "installing",
      });
      const pid = await launchWindowsNsisInstaller(dest);
      logLine(`packaged-update: installer launched pid=${pid} path=${dest}`);
      // 不在此 quit：installer.nsh 通过 --quit-for-install / taskkill 关闭应用；
      // 过早 app.quit() 会在 Windows 上中断 NSIS 子进程（删完旧版、未解压新版）。
      return { ok: true as const, pid };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      logLine(`packaged-update: failed ${message}${stack ? `\n${stack}` : ""}`);
      throw err instanceof Error ? err : new Error(message);
    }
  });
}
