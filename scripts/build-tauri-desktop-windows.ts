#!/usr/bin/env bun
/**
 * Linux/macOS → Windows Tauri NSIS 交叉编译。
 * 依赖：rustup target x86_64-pc-windows-msvc、cargo-xwin、nsis（makensis）、lld/clang。
 */
import { existsSync, readdirSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const TARGET = "x86_64-pc-windows-msvc";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src/app/shell/tauri");
const nsisOut = join(tauriDir, "src-tauri/target", TARGET, "release/bundle/nsis");

function which(cmd: string): boolean {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
  return r.status === 0;
}

function ensureCrossWindowsToolchain(): void {
  const missing: string[] = [];

  const xwin = spawnSync("cargo", ["xwin", "--version"], { stdio: "ignore", shell: true });
  if (xwin.status !== 0) {
    missing.push("cargo-xwin（安装：cargo install --locked cargo-xwin）");
  }

  const targets = spawnSync("rustup", ["target", "list", "--installed"], {
    encoding: "utf-8",
    shell: true,
  });
  const installed = targets.stdout ?? "";
  if (!installed.includes(TARGET)) {
    missing.push(`rust target ${TARGET}（安装：rustup target add ${TARGET}）`);
  }

  if (process.platform === "linux" || process.platform === "darwin") {
    if (!which("makensis")) {
      missing.push("nsis / makensis（Debian：sudo apt-get install -y nsis）");
    }
  }

  if (missing.length === 0) return;
  console.error(
    "[pack tauri-windows] 交叉编译工具链不完整：\n" +
      missing.map((m) => `  - ${m}`).join("\n") +
      "\n请先：just install tauri-windows\n  # 或缺系统包：just install tauri-windows -- --apt",
  );
  process.exit(1);
}

/** Tauri NSIS 文件名跟 productName，空格改成 `-`（对齐 FreeAnima-Desktop-*.exe） */
function normalizeNsisInstallerName(): string | null {
  if (!existsSync(nsisOut)) return null;
  const setup = readdirSync(nsisOut).find((n) => n.endsWith("-setup.exe"));
  if (!setup) return null;
  const normalized = setup.replace(/ +/g, "-");
  if (normalized !== setup) {
    renameSync(join(nsisOut, setup), join(nsisOut, normalized));
  }
  return normalized;
}

function copyInstallerToDist(): void {
  const setup = normalizeNsisInstallerName();
  if (!setup) {
    console.error("[pack tauri-windows] 未找到 NSIS setup.exe");
    process.exit(1);
  }
  emitPackArtifact({
    kind: "desktop-windows-nsis",
    sourcePath: join(nsisOut, setup),
    logPrefix: "[pack tauri-windows]",
  });
  console.log(`[pack tauri-windows] nsis: ${setup}`);
}

ensureCrossWindowsToolchain();

const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
  cwd: root,
  stdio: "inherit",
});
if (prep.status !== 0) process.exit(prep.status ?? 1);

const identity = applyTauriShellIdentity({ target: "desktop" });

// ring 交叉会产生海量 -Wunsafe-buffer-usage，易撑爆 CI 日志；
// 默认 4 并行（速度优先）；若 xwin+ring OOM，可设 CARGO_BUILD_JOBS=2。
const buildEnv = {
  ...process.env,
  FREEANIMA_BUILD_CHANNEL: identity.channel,
  CARGO_BUILD_JOBS: process.env.CARGO_BUILD_JOBS?.trim() || "4",
  CFLAGS: [process.env.CFLAGS, "-Wno-unsafe-buffer-usage", "-w"].filter(Boolean).join(" "),
  CXXFLAGS: [process.env.CXXFLAGS, "-Wno-unsafe-buffer-usage", "-w"].filter(Boolean).join(" "),
};

const build = spawnSync(
  "bunx",
  [
    "tauri",
    "build",
    "--runner",
    "cargo-xwin",
    "--target",
    TARGET,
    "--bundles",
    "nsis",
    "--config",
    identity.configArg,
  ],
  {
    cwd: tauriDir,
    stdio: "inherit",
    shell: true,
    env: buildEnv,
  },
);
if (build.status !== 0) process.exit(build.status ?? 1);

copyInstallerToDist();
process.exit(0);
