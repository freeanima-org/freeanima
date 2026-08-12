#!/usr/bin/env bun
/**
 * 打包桌面 Tauri（当前宿主平台）：
 * - Linux → AppImage
 * - Windows → NSIS（需本机 MSVC）
 * - macOS → tauri 默认 bundle（未单独 emit dist 别名）
 *
 * 入口：`just pack tauri`；Windows 上亦由 `just pack tauri-windows` 调用。
 */
import { existsSync, readdirSync, renameSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { clearStaleNsisSetups, matchNsisSetupForProduct } from "./build-tauri-desktop-windows.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const LOG = "[pack tauri]";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/portal/app/tauri");
const bundleRoot = join(tauriDir, "src-tauri/target/release/bundle");
const nsisOut = join(bundleRoot, "nsis");

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

function emitWindowsNsis(productName: string): void {
  if (!existsSync(nsisOut)) {
    console.error(`${LOG} 缺少 NSIS 输出目录：${nsisOut}`);
    process.exit(1);
  }
  const files = readdirSync(nsisOut);
  const picked = matchNsisSetupForProduct(files, productName);
  if (!picked.ok) {
    console.error(`${LOG} ${picked.reason}`);
    if (picked.matches.length > 0) {
      console.error(picked.matches.map((m) => `  - ${m}`).join("\n"));
    } else {
      console.error(`  目录内容：${files.join(", ") || "(空)"}`);
    }
    process.exit(1);
  }
  let setup = picked.name;
  const normalized = setup.replace(/ +/g, "-");
  if (normalized !== setup) {
    renameSync(join(nsisOut, setup), join(nsisOut, normalized));
    setup = normalized;
  }
  emitPackArtifact({
    kind: "desktop-windows-nsis",
    sourcePath: join(nsisOut, setup),
    logPrefix: LOG,
  });
  console.log(`${LOG} nsis: ${setup} (productName=${productName})`);
}

if (process.platform === "win32") {
  const cleared = clearStaleNsisSetups(nsisOut);
  if (cleared > 0) console.log(`${LOG} 已清除 ${cleared} 个旧 NSIS setup`);
}

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
console.log(`${LOG} host=${process.platform} channel=${identity.channel}`);
const build = spawnSync(
  "bun",
  ["x", "tauri", "build", ...bundles, "--config", identity.configArg],
  {
    cwd: tauriDir,
    stdio: "inherit",
    shell: true,
    env: buildEnv,
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

if (process.platform === "linux") {
  const appImage = findAppImage(bundleRoot);
  if (!appImage) {
    console.error(`${LOG} 未找到 AppImage`);
    process.exit(1);
  }
  emitPackArtifact({
    kind: "desktop-linux-appimage",
    sourcePath: appImage,
    logPrefix: LOG,
  });
} else if (process.platform === "win32") {
  const productName = identity.desktop?.productName;
  if (!productName) {
    console.error(`${LOG} 缺少 desktop identity.productName`);
    process.exit(1);
  }
  emitWindowsNsis(productName);
}

process.exit(0);
