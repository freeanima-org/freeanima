import { app, ipcMain } from "electron";

import { logLine } from "./log.ts";
import {
  createInstallerTempPath,
  downloadInstallerToFile,
  launchWindowsNsisInstaller,
  parsePackagedUpdatePayload,
  verifyDownloadedInstaller,
} from "./packaged-update.ts";

export function registerPackagedUpdateIpc(): void {
  ipcMain.handle("shell:apply-packaged-update", async (_event, payload: unknown) => {
    try {
      const { assetUrl, expectedSize } = parsePackagedUpdatePayload(payload);
      const dest = createInstallerTempPath(app.getPath("temp"));
      logLine(`packaged-update: downloading ${assetUrl} → ${dest}`);
      await downloadInstallerToFile(assetUrl, dest);
      verifyDownloadedInstaller(dest, expectedSize);
      logLine(`packaged-update: verified installer (${expectedSize ?? "unknown"} bytes expected)`);
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
