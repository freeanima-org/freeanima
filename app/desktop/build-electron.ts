import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import * as esbuild from "esbuild";
import { build as runElectronBuilder, type CliOptions } from "electron-builder";

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
  "@freeanima/satellite-sdk",
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

export function getElectronMainBundleOptions(): esbuild.BuildOptions {
  return {
    entryPoints: { main: join(SHELL_ROOT, "electron", "main.ts") },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(ELECTRON_DIST, "main.cjs"),
    external: electronMainExternals(),
    logLevel: "info",
  };
}

export function getElectronPreloadBundleOptions(): esbuild.BuildOptions {
  return {
    entryPoints: { preload: join(SHELL_ROOT, "electron", "preload.ts") },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(ELECTRON_DIST, "preload.cjs"),
    external: ["electron"],
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

async function buildVendorAssets(minify: boolean): Promise<void> {
  const companionDist = await buildCompanionApp({ minify });
  const shellUiDist = await buildShellUi({ minify });
  copyDist(companionDist, join(SHELL_ROOT, "vendor", "companion", "dist"));
  copyDist(shellUiDist, join(SHELL_ROOT, "vendor", "shell-ui", "dist"));
}

async function bundleElectronMain(): Promise<void> {
  rmSync(ELECTRON_DIST, { recursive: true, force: true });
  mkdirSync(ELECTRON_DIST, { recursive: true });
  await esbuild.build(getElectronMainBundleOptions());
  await esbuild.build(getElectronPreloadBundleOptions());
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

function stageFbxBinary(platform: string): void {
  const binDir = join(SHELL_ROOT, "build-resources", "bin");
  mkdirSync(binDir, { recursive: true });
  if (platform === "win" || platform === "win32") {
    const src = join(FBX_KIT, "FBX2glTF-windows-x64.exe");
    if (!existsSync(src)) {
      throw new Error(`missing ${src}; run bun run setup:fbx in satellites/companion`);
    }
    cpSync(src, join(binDir, "FBX2glTF-windows-x64.exe"));
  }
}

function patchElectronBuilderForLinuxNsis(): void {
  if (process.platform !== "linux") return;

  // electron-builder 在 Linux 上默认用 Wine 运行 NSIS 安装包以提取 uninstaller；
  // 与 macOS 相同，UninstallerReader 可直接解析 PE/NSIS，无需 Wine。
  const requireShell = createRequire(join(SHELL_ROOT, "package.json"));
  const requireEb = createRequire(requireShell.resolve("electron-builder"));
  const macosVersion = requireEb("app-builder-lib/out/util/macosVersion") as {
    isMacOsCatalina: () => boolean;
  };
  macosVersion.isMacOsCatalina = () => true;
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

export async function buildDesktopShellElectron(opts: BuildElectronOptions = {}): Promise<void> {
  const profile = opts.profile ?? resolveProfile();
  const minify = profile === "release";
  const platform = opts.platform ?? process.platform;

  console.log(`[desktop-shell] build profile=${profile} platform=${platform}`);
  cleanCompanionBuildArtifacts();
  await buildVendorAssets(minify);
  await bundleElectronMain();
  stageFbxBinary(platform);

  const version = resolveBuildVersion(opts.version);
  patchElectronBuilderForLinuxNsis();
  await runElectronBuilder(buildElectronBuilderOptions(platform, profile, version));
  console.log("[desktop-shell] build complete");
}

if (import.meta.main) {
  await buildDesktopShellElectron({ platform: parsePlatformArg() });
}
