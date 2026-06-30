import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import type { CliOptions } from "electron-builder";

import { buildShellUi } from "@freeanima/shell-ui/build";
import { buildCompanionApp } from "@freeanima/satellite-companion/build";

const SHELL_ROOT = import.meta.dir;
const REPO_ROOT = join(SHELL_ROOT, "..", "..");
const ELECTRON_DIST = join(SHELL_ROOT, "electron-dist");
const COMPANION_ROOT = join(REPO_ROOT, "satellites", "companion");
const FBX_KIT = join(COMPANION_ROOT, "node_modules", "fbx2vrma-converter");
const PACKAGE_JSON = join(SHELL_ROOT, "package.json");

const BUNDLED_WORKSPACE_PACKAGES = new Set([
  "@freeanima/sap-contract",
  "@freeanima/shell-sdk",
  "@freeanima/satellite-companion",
  "@freeanima/satellite-chat",
  "@freeanima/admin-frontend",
  "@freeanima/shell-ui",
]);

/** 纯 JS 依赖打进 main bundle，避免 electron-builder 复制 node_modules */
const BUNDLED_NPM_PACKAGES = new Set(["zod", "ws", "fbx2vrma-converter"]);

function electronMainExternals(): string[] {
  const shellPkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const companionPkg = JSON.parse(readFileSync(join(COMPANION_ROOT, "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const externals = new Set<string>(["electron"]);
  for (const dep of Object.keys({ ...shellPkg.dependencies, ...companionPkg.dependencies })) {
    if (BUNDLED_WORKSPACE_PACKAGES.has(dep)) continue;
    if (BUNDLED_NPM_PACKAGES.has(dep)) continue;
    externals.add(dep);
  }
  return [...externals];
}

export function getElectronMainBundleOptions(opts?: { sourcemap?: boolean }): esbuild.BuildOptions {
  return {
    entryPoints: { main: join(SHELL_ROOT, "electron", "main.ts") },
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
}): esbuild.BuildOptions {
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
  const shellUiDist = await buildShellUi({
    appDir: join(SHELL_ROOT, "app"),
    minify: opts.minify,
    sourcemap: opts.sourcemap,
  });
  copyDist(companionDist, join(SHELL_ROOT, "vendor", "companion", "dist"));
  copyDist(shellUiDist, join(SHELL_ROOT, "vendor", "shell-ui", "dist"));
}

async function bundleElectronMain(sourcemap: boolean): Promise<void> {
  rmSync(ELECTRON_DIST, { recursive: true, force: true });
  mkdirSync(ELECTRON_DIST, { recursive: true });
  const bundleOpts = { sourcemap };
  await esbuild.build(getElectronMainBundleOptions(bundleOpts));
  await esbuild.build(getElectronPreloadBundleOptions(bundleOpts));
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

function resolveWindowsFbx2gltfExe(): string {
  const cacheHome = process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
  const candidates = [
    join(FBX_KIT, "FBX2glTF-windows-x64.exe"),
    join(cacheHome, "tools", "fbx2gltf", "FBX2glTF-windows-x64.exe"),
  ];
  for (const path of candidates) {
    if (existsSync(path) && statSync(path).size > 1_000_000) return path;
  }
  throw new Error(
    "missing FBX2glTF-windows-x64.exe; run bun run setup:fbx in satellites/companion",
  );
}

function stageFbxBinary(platform: string): void {
  const binDir = join(SHELL_ROOT, "build-resources", "bin");
  mkdirSync(binDir, { recursive: true });
  if (platform === "win" || platform === "win32") {
    const src = resolveWindowsFbx2gltfExe();
    cpSync(src, join(binDir, "FBX2glTF-windows-x64.exe"));
  }
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
  const requireEb = createRequire(join(SHELL_ROOT, "package.json"));
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
  await bundleElectronMain(sourcemap);
  stageFbxBinary(platform);
  if (fullClean) {
    cleanReleaseDir();
  }

  const version = resolveBuildVersion(opts.version);
  runElectronBuilderViaNode(buildElectronBuilderOptions(platform, profile, version));
  console.log("[desktop-shell] build complete");
}

if (import.meta.main) {
  await buildDesktopShellElectron({ platform: parsePlatformArg() });
}
