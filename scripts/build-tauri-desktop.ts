#!/usr/bin/env bun
/** 打包桌面 Tauri（当前宿主平台） */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/app/shell/tauri");

function ensureLinuxWebkitDeps(): void {
  if (process.platform !== "linux") return;
  const check = spawnSync("pkg-config", ["--exists", "javascriptcoregtk-4.1", "webkit2gtk-4.1"], {
    stdio: "ignore",
  });
  if (check.status === 0) return;
  console.error(
    "[package:tauri] 缺少 Linux WebKitGTK 开发库。请安装：\n" +
      "  just install-tauri-linux -- --apt\n" +
      "  # 或 sudo apt-get install -y libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \\\n" +
      "  #   libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf",
  );
  process.exit(1);
}

ensureLinuxWebkitDeps();

const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const build = spawnSync("bunx", ["tauri", "build"], {
  cwd: tauriDir,
  stdio: "inherit",
  shell: true,
  env: process.env,
});
process.exit(build.status ?? 1);
