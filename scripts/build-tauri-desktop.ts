#!/usr/bin/env bun
/** 打包桌面 Tauri（当前宿主平台） */
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/portal/app/tauri");
const bundleRoot = join(tauriDir, "src-tauri/target/release/bundle");

function ensureLinuxWebkitDeps(): void {
  if (process.platform !== "linux") return;
  const check = spawnSync("pkg-config", ["--exists", "javascriptcoregtk-4.1", "webkit2gtk-4.1"], {
    stdio: "ignore",
  });
  if (check.status === 0) return;
  console.error(
    "[pack tauri-linux] 缺少 Linux WebKitGTK 开发库。请安装：\n" +
      "  just install tauri-linux -- --apt\n" +
      "  # 或 sudo apt-get install -y libwebkit2gtk-4.1-dev libjavascriptcoregtk-4.1-dev \\\n" +
      "  #   libsoup-3.0-dev libappindicator3-dev librsvg2-dev patchelf",
  );
  process.exit(1);
}

function findAppImage(dir: string): string | null {
  if (!existsSync(dir)) return null;
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    for (const name of readdirSync(cur)) {
      const p = join(cur, name);
      const st = statSync(p);
      if (st.isDirectory()) {
        stack.push(p);
      } else if (name.endsWith(".AppImage")) {
        return p;
      }
    }
  }
  return null;
}

ensureLinuxWebkitDeps();

const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const identity = applyTauriShellIdentity({ target: "desktop" });
const buildEnv = {
  ...process.env,
  FREEANIMA_BUILD_CHANNEL: identity.channel,
};

// 只打 CI/发布实际收集的格式，避免 targets=all 白打 deb/rpm
const bundles = process.platform === "linux" ? ["--bundles", "appimage"] : [];
const build = spawnSync("bunx", ["tauri", "build", ...bundles, "--config", identity.configArg], {
  cwd: tauriDir,
  stdio: "inherit",
  shell: true,
  env: buildEnv,
});
if (build.status !== 0) process.exit(build.status ?? 1);

if (process.platform === "linux") {
  const appImage = findAppImage(bundleRoot);
  if (!appImage) {
    console.error("[pack tauri-linux] 未找到 AppImage");
    process.exit(1);
  }
  emitPackArtifact({
    kind: "desktop-linux-appimage",
    sourcePath: appImage,
    logPrefix: "[pack tauri-linux]",
  });
}

process.exit(0);
