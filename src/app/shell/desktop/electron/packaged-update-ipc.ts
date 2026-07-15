import { app, ipcMain } from "electron";
import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";

import { logLine } from "./log.ts";

async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, {
    headers: { "User-Agent": "freeanima-desktop-updater", Accept: "application/octet-stream" },
    redirect: "follow",
  });
  if (!res.ok || !res.body) {
    throw new Error(`下载安装包失败 HTTP ${res.status}`);
  }
  const nodeStream = Readable.fromWeb(
    res.body as unknown as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(dest));
}

export function registerPackagedUpdateIpc(): void {
  ipcMain.handle("shell:apply-packaged-update", async (_event, assetUrl: unknown) => {
    if (typeof assetUrl !== "string" || !assetUrl.startsWith("https://")) {
      throw new Error("无效的安装包 URL");
    }
    const dest = join(app.getPath("temp"), "freeanima-desktop-windows-x64-setup.exe");
    logLine(`packaged-update: downloading ${assetUrl} → ${dest}`);
    await downloadToFile(assetUrl, dest);
    logLine(`packaged-update: launching installer ${dest}`);
    const child = spawn(dest, ["/S"], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    child.unref();
    // 给安装器一点时间拉起，再退出以配合 NSIS 覆盖
    setTimeout(() => {
      app.quit();
    }, 500);
    return { ok: true as const };
  });
}
