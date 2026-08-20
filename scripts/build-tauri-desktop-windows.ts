#!/usr/bin/env bun
/**
 * Linux/macOS → Windows Tauri NSIS 交叉编译。
 * 依赖：rustup target x86_64-pc-windows-msvc、cargo-xwin、nsis（makensis）、lld/clang。
 */
import { existsSync, readdirSync, renameSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyTauriShellIdentity } from "./apply-tauri-shell-identity.ts";
import { emitPackArtifact } from "./emit-pack-artifact.ts";

const TARGET = "x86_64-pc-windows-msvc";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "packages/frontend/portal/app/tauri");
const nsisOut = join(tauriDir, "src-tauri/target", TARGET, "release/bundle/nsis");

function which(cmd: string): boolean {
  const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
  return r.status === 0;
}

function ensureCrossWindowsToolchain(): void {
  const missing: string[] = [];

  if (!which("cargo-xwin")) {
    const xwin = spawnSync("cargo", ["xwin", "--version"], { stdio: "ignore", shell: false });
    if (xwin.status !== 0) {
      missing.push("cargo-xwin（安装：cargo install --locked cargo-xwin，或 nix develop）");
    }
  }

  const rustupTargets = which("rustup")
    ? (spawnSync("rustup", ["target", "list", "--installed"], {
        encoding: "utf-8",
        shell: false,
      }).stdout ?? "")
    : "";
  const sysroot = (
    spawnSync("rustc", ["--print", "sysroot"], { encoding: "utf-8", shell: false }).stdout ?? ""
  ).trim();
  const hasTarget =
    rustupTargets.includes(TARGET) ||
    Boolean(sysroot && existsSync(join(sysroot, "lib", "rustlib", TARGET)));
  if (!hasTarget) {
    missing.push(`rust target ${TARGET}（安装：rustup target add ${TARGET}，或 nix develop）`);
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

/** 构建前清掉旧 setup，避免与本次 productName 产物并存被误选 */
export function clearStaleNsisSetups(dir: string = nsisOut): number {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith("-setup.exe")) continue;
    unlinkSync(join(dir, name));
    n += 1;
  }
  return n;
}

/**
 * Tauri NSIS 名形如 `{productName}_{version}_x64-setup.exe`。
 * 必须按 productName 前缀匹配，避免 `FreeAnima_` 与 `FreeAnima Local_` 并存时误选。
 */
export function matchNsisSetupForProduct(
  fileNames: string[],
  productName: string,
): { ok: true; name: string } | { ok: false; reason: string; matches: string[] } {
  const spacedPrefix = `${productName}_`;
  const dashedPrefix = `${productName.replace(/ +/g, "-")}_`;
  const matches = fileNames.filter(
    (n) => n.endsWith("-setup.exe") && (n.startsWith(spacedPrefix) || n.startsWith(dashedPrefix)),
  );
  if (matches.length === 0) {
    return {
      ok: false,
      reason: `未找到 productName=${JSON.stringify(productName)} 的 NSIS setup`,
      matches,
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      reason: `找到多个 productName=${JSON.stringify(productName)} 的 NSIS setup`,
      matches,
    };
  }
  const only = matches[0];
  if (!only) {
    return {
      ok: false,
      reason: `未找到 productName=${JSON.stringify(productName)} 的 NSIS setup`,
      matches,
    };
  }
  return { ok: true, name: only };
}

function resolveNsisInstallerName(productName: string): string {
  if (!existsSync(nsisOut)) {
    console.error(`[pack tauri-windows] 缺少 NSIS 输出目录：${nsisOut}`);
    process.exit(1);
  }
  const files = readdirSync(nsisOut);
  const picked = matchNsisSetupForProduct(files, productName);
  if (!picked.ok) {
    console.error(`[pack tauri-windows] ${picked.reason}`);
    if (picked.matches.length > 0) {
      console.error(picked.matches.map((m) => `  - ${m}`).join("\n"));
    } else {
      console.error(`  目录内容：${files.join(", ") || "(空)"}`);
    }
    process.exit(1);
  }
  const setup = picked.name;
  const normalized = setup.replace(/ +/g, "-");
  if (normalized !== setup) {
    renameSync(join(nsisOut, setup), join(nsisOut, normalized));
  }
  return normalized;
}

function copyInstallerToDist(productName: string): void {
  const setup = resolveNsisInstallerName(productName);
  emitPackArtifact({
    kind: "desktop-windows-nsis",
    sourcePath: join(nsisOut, setup),
    logPrefix: "[pack tauri-windows]",
  });
  console.log(`[pack tauri-windows] nsis: ${setup} (productName=${productName})`);
}

function main(): void {
  ensureCrossWindowsToolchain();

  const cleared = clearStaleNsisSetups();
  if (cleared > 0) {
    console.log(`[pack tauri-windows] 已清除 ${cleared} 个旧 NSIS setup`);
  }

  const prep = spawnSync("bun", ["scripts/prepare-tauri-ui.ts"], {
    cwd: root,
    stdio: "inherit",
  });
  if (prep.status !== 0) process.exit(prep.status ?? 1);

  const identity = applyTauriShellIdentity({ target: "desktop" });
  const productName = identity.desktop?.productName;
  if (!productName) {
    console.error("[pack tauri-windows] 缺少 desktop identity.productName");
    process.exit(1);
  }

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
    "bun",
    [
      "x",
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

  copyInstallerToDist(productName);
}

if (import.meta.main) {
  main();
}
