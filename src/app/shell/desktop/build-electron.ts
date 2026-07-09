import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import type { CliOptions } from "electron-builder";

import { buildShellUi } from "@freeanima/frontend/shell-ui/build.ts";
import { buildCompanionApp } from "@freeanima/satellites/companion/lib/exports/build.ts";
import { nativeBuildMetaDefine } from "@freeanima/frontend/shell-sdk/native-build-meta";
import { resolveNativeBuildMeta } from "../shared/resolve-native-build-meta.ts";
import { assertElectronMainBundle } from "./electron-main-bundle-assert.ts";

const SHELL_ROOT = import.meta.dir;
const REPO_ROOT = join(SHELL_ROOT, "..", "..", "..", "..");
const ELECTRON_DIST = join(SHELL_ROOT, "electron-dist");
const MAIN_BUNDLE_PATH = join(ELECTRON_DIST, "main.cjs");
const COMPANION_ROOT = join(REPO_ROOT, "src", "satellites", "companion");
const ROOT_PACKAGE_JSON = join(REPO_ROOT, "package.json");

const BUNDLED_INTERNAL_PACKAGES = new Set([
  "@freeanima/sap-contract",
  "@freeanima/shell-sdk",
  "@freeanima/satellite-companion",
  "@freeanima/feature-chat",
  "@freeanima/feature-console",
  "@freeanima/shell-ui",
]);

/**
 * 必须打进 main.cjs 的 npm 包（纯 JS 或 ESM-only）。
 * 新增主进程 npm 依赖时：默认加入此集合，否则会被标为 external 且安装包无 node_modules。
 */
const BUNDLED_NPM_PACKAGES = new Set(["zod", "ws", "commander", "electron-store"]);

/**
 * 允许 runtime require 但不打进 asar（可选 native / 死分支）。
 * 见 electron-main-bundle-assert.ts OPTIONAL_EXTERNAL_PACKAGES。
 */
const ELECTRON_MAIN_EXTERNAL_ALLOWLIST = new Set(["electron", "bufferutil", "utf-8-validate"]);

function electronMainExternals(): string[] {
  const rootPkg = JSON.parse(readFileSync(ROOT_PACKAGE_JSON, "utf-8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const externals = new Set<string>(ELECTRON_MAIN_EXTERNAL_ALLOWLIST);
  for (const dep of Object.keys({
    ...rootPkg.dependencies,
    ...rootPkg.devDependencies,
  })) {
    if (BUNDLED_INTERNAL_PACKAGES.has(dep)) continue;
    if (BUNDLED_NPM_PACKAGES.has(dep)) continue;
    externals.add(dep);
  }
  return [...externals];
}

export function getElectronMainBundleOptions(opts?: { sourcemap?: boolean }): esbuild.BuildOptions {
  return {
    entryPoints: { main: join(SHELL_ROOT, "electron", "main-entry.ts") },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(ELECTRON_DIST, "main.cjs"),
    external: electronMainExternals(),
    sourcemap: opts?.sourcemap ?? false,
    logLevel: "info",
  };
}

export function getElectronPreloadBundleOptions(opts?: {
  sourcemap?: boolean;
  profile?: BuildProfile;
  version?: string;
}): esbuild.BuildOptions {
  const channel = opts?.profile === "release" ? "prod" : "dev";
  const nativeMeta = resolveNativeBuildMeta({
    shell: "desktop",
    channel,
    repoRoot: REPO_ROOT,
    ...(opts?.version ? { version: opts.version } : {}),
  });
  return {
    entryPoints: { preload: join(SHELL_ROOT, "electron", "preload.ts") },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(ELECTRON_DIST, "preload.cjs"),
    external: ["electron"],
    sourcemap: opts?.sourcemap ?? false,
    logLevel: "info",
    define: nativeBuildMetaDefine(nativeMeta),
  };
}

export type BuildProfile = "fast" | "release";

export type BuildElectronOptions = {
  platform?: "win" | "mac" | "linux";
  profile?: BuildProfile;
  version?: string;
};

function resolveProfile(): BuildProfile {
  const raw = process.env.DESKTOP_SHELL_BUILD_PROFILE?.trim().toLowerCase();
  return raw === "release" ? "release" : "fast";
}

function parsePlatformArg(): BuildElectronOptions["platform"] | undefined {
  const idx = process.argv.indexOf("--platform");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1] as BuildElectronOptions["platform"];
  }
  return undefined;
}

function readRootPackageVersion(): string {
  const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
    version?: string;
  };
  const version = rootPkg.version?.trim();
  if (!version) throw new Error("根 package.json 缺少 version");
  return version;
}

function resolveBuildVersion(explicit?: string): string {
  const fromEnv = process.env.DESKTOP_SHELL_VERSION?.trim();
  const raw = explicit?.trim() || fromEnv;
  if (raw) return raw.replace(/^v/i, "");
  return readRootPackageVersion();
}

function copyDist(src: string, dest: string): void {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

async function buildVendorAssets(opts: { minify: boolean; sourcemap: boolean }): Promise<void> {
  const companionDist = await buildCompanionApp(opts);
  copyDist(companionDist, join(SHELL_ROOT, "vendor", "companion", "dist"));
  if (resolveDesktopUiMode() === "bundled") {
    const shellUiDist = await buildShellUi({
      appDir: join(SHELL_ROOT, "spa"),
      minify: opts.minify,
      sourcemap: opts.sourcemap,
    });
    copyDist(shellUiDist, join(SHELL_ROOT, "vendor", "shell-ui", "dist"));
  } else {
    rmSync(join(SHELL_ROOT, "vendor", "shell-ui"), { recursive: true, force: true });
    console.log("[desktop-shell] remote UI mode — skip vendor/shell-ui bundle");
  }
}

function resolveDesktopUiMode(): "remote" | "bundled" {
  const raw = process.env.DESKTOP_UI_MODE?.trim().toLowerCase();
  return raw === "bundled" ? "bundled" : "remote";
}

async function bundleElectronMain(
  sourcemap: boolean,
  profile: BuildProfile,
  version: string,
): Promise<void> {
  rmSync(ELECTRON_DIST, { recursive: true, force: true });
  mkdirSync(ELECTRON_DIST, { recursive: true });
  const bundleOpts = { sourcemap, profile, version };
  await esbuild.build(getElectronMainBundleOptions(bundleOpts));
  await esbuild.build(getElectronPreloadBundleOptions(bundleOpts));
  const mainCode = readFileSync(MAIN_BUNDLE_PATH, "utf-8");
  assertElectronMainBundle(mainCode);
  console.log("[desktop-shell] main bundle invariants OK");
}

/** 清除 vendor 残留（如历史 chat/admin 目录），避免 electron-builder 误打进安装包 */
function cleanVendorDir(): void {
  const vendorDir = join(SHELL_ROOT, "vendor");
  if (!existsSync(vendorDir)) return;
  rmSync(vendorDir, { recursive: true, force: true });
  console.log("[desktop-shell] cleaned vendor/");
}

/** 清除 release 输出，避免旧 win-unpacked / 安装包残留 */
function cleanReleaseDir(): void {
  const releaseDir = join(SHELL_ROOT, "release");
  if (!existsSync(releaseDir)) return;
  rmSync(releaseDir, { recursive: true, force: true });
  console.log("[desktop-shell] cleaned release/");
}

/** 清除 companion 本地构建/缓存残留，避免 electron-builder 误打进 desktop-shell */
function cleanCompanionBuildArtifacts(): void {
  let cleaned = false;
  for (const name of ["release", ".cache"]) {
    const dir = join(COMPANION_ROOT, name);
    if (!existsSync(dir)) continue;
    rmSync(dir, { recursive: true, force: true });
    cleaned = true;
  }
  if (cleaned) console.log("[desktop-shell] cleaned companion build artifacts");
}

function buildElectronBuilderOptions(
  platform: string,
  profile: BuildProfile,
  version: string,
): CliOptions {
  const opts: CliOptions = {
    config: {
      extends: join(SHELL_ROOT, "electron-builder.yml"),
      extraMetadata: { version },
    },
    projectDir: SHELL_ROOT,
  };
  if (profile === "fast") opts.dir = true;
  if (platform === "win" || platform === "win32") {
    opts.win = profile === "release" ? ["nsis"] : [];
    opts.x64 = true;
  } else if (platform === "mac" || platform === "darwin") {
    opts.mac = profile === "release" ? ["dmg"] : [];
  } else {
    opts.linux = profile === "release" ? ["AppImage"] : [];
  }
  return opts;
}

function buildElectronBuilderCliArgs(opts: CliOptions): string[] {
  const args: string[] = [];
  if (opts.dir) args.push("--dir");
  if (opts.x64) args.push("--x64");
  if (opts.win !== undefined) {
    args.push("--win");
    for (const target of opts.win) {
      if (target) args.push(String(target));
    }
  }
  if (opts.mac !== undefined) {
    args.push("--mac");
    for (const target of opts.mac) {
      if (target) args.push(String(target));
    }
  }
  if (opts.linux !== undefined) {
    args.push("--linux");
    for (const target of opts.linux) {
      if (target) args.push(String(target));
    }
  }
  const cfg = opts.config;
  const version =
    cfg && typeof cfg === "object" && "extraMetadata" in cfg
      ? (cfg as { extraMetadata?: { version?: string } }).extraMetadata?.version
      : undefined;
  if (typeof version === "string" && version.length > 0) {
    args.push(`-c.extraMetadata.version=${version}`);
  }
  return args;
}

/** Bun fetch 对部分 CDN 会 UNKNOWN_CERTIFICATE_VERIFICATION_ERROR；打包阶段改由 Node 跑 electron-builder */
function runElectronBuilderViaNode(opts: CliOptions): void {
  const requireEb = createRequire(ROOT_PACKAGE_JSON);
  const cliPath = requireEb.resolve("electron-builder/cli.js");
  const patchPath = join(SHELL_ROOT, "electron-builder-linux-patch.cjs");
  const args = buildElectronBuilderCliArgs(opts);
  console.log(`[desktop-shell] electron-builder (node): ${args.join(" ")}`);
  const result = spawnSync("node", ["-r", patchPath, cliPath, ...args], {
    cwd: SHELL_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`electron-builder exited with code ${result.status ?? "unknown"}`);
  }
}

export async function buildDesktopShellElectron(opts: BuildElectronOptions = {}): Promise<void> {
  const profile = opts.profile ?? resolveProfile();
  const minify = profile === "release";
  const platform = opts.platform ?? process.platform;
  const fullClean = profile === "release" || process.env.DESKTOP_SHELL_CLEAN?.trim() === "1";

  console.log(`[desktop-shell] build profile=${profile} platform=${platform}`);
  cleanCompanionBuildArtifacts();
  if (fullClean) {
    cleanVendorDir();
  }
  const sourcemap = profile !== "release";
  await buildVendorAssets({ minify, sourcemap });
  const version = resolveBuildVersion(opts.version);
  await bundleElectronMain(sourcemap, profile, version);
  if (fullClean) {
    cleanReleaseDir();
  }

  runElectronBuilderViaNode(buildElectronBuilderOptions(platform, profile, version));
  console.log("[desktop-shell] build complete");
}

if (import.meta.main) {
  const platform = parsePlatformArg();
  await buildDesktopShellElectron(platform ? { platform } : {});
}
