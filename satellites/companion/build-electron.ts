import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import * as esbuild from "esbuild";
import { build as runElectronBuilder, type CliOptions } from "electron-builder";
import { buildCompanionApp } from "./build.ts";

const COMPANION_ROOT = import.meta.dir;
const requireFromElectronBuilder = createRequire(
  createRequire(join(COMPANION_ROOT, "package.json")).resolve("electron-builder/package.json"),
);
const REPO_ROOT = join(COMPANION_ROOT, "..", "..");
const ELECTRON_DIST = join(COMPANION_ROOT, "electron-dist");
const FBX_KIT = join(COMPANION_ROOT, "node_modules", "fbx2vrma-converter");
const PACKAGE_JSON = join(COMPANION_ROOT, "package.json");

/** workspace 包导出 .ts，须打进 bundle；其余 npm 依赖保持 external，避免 CJS（如 ws）在 ESM 输出里 dynamic require 失败 */
const BUNDLED_WORKSPACE_PACKAGES = new Set(["@freeanima/sap-contract"]);

function electronMainExternals(): string[] {
  const pkg = JSON.parse(readFileSync(PACKAGE_JSON, "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const externals = ["electron"];
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!BUNDLED_WORKSPACE_PACKAGES.has(dep)) {
      externals.push(dep);
    }
  }
  return externals;
}

export function getElectronMainBundleOptions(): esbuild.BuildOptions {
  return {
    entryPoints: {
      main: join(COMPANION_ROOT, "electron", "main.ts"),
    },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "esm",
    outdir: ELECTRON_DIST,
    external: electronMainExternals(),
    logLevel: "info",
  };
}

export function getElectronPreloadBundleOptions(): esbuild.BuildOptions {
  return {
    entryPoints: {
      preload: join(COMPANION_ROOT, "electron", "preload.ts"),
    },
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile: join(ELECTRON_DIST, "preload.cjs"),
    external: ["electron"],
    logLevel: "info",
  };
}

/** @deprecated 使用 getElectronMainBundleOptions + getElectronPreloadBundleOptions */
export function getElectronBundleOptions(): esbuild.BuildOptions {
  return getElectronMainBundleOptions();
}

export type BuildProfile = "fast" | "release";

export type BuildElectronOptions = {
  platform?: "win" | "mac" | "linux";
  profile?: BuildProfile;
  version?: string;
};

function resolveProfile(): BuildProfile {
  const raw = process.env.COMPANION_BUILD_PROFILE?.trim().toLowerCase();
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
  if (!version) {
    throw new Error("根 package.json 缺少 version");
  }
  return version;
}

/** 版本 SSOT：根 package.json；发版 CI 可用 COMPANION_VERSION 覆盖 tag */
function resolveBuildVersion(explicit?: string): string {
  const fromEnv = process.env.COMPANION_VERSION?.trim();
  const raw = explicit?.trim() || fromEnv;
  if (raw) return raw.replace(/^v/i, "");
  return readRootPackageVersion();
}

function electronBuilderEnv(platform: string): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const isWinTarget = platform === "win" || platform === "win32";
  if (isWinTarget && process.platform !== "win32") {
    env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  }
  return env;
}

/**
 * Linux 交叉打 NSIS 时，electron-builder 默认用 Wine 执行 stub 安装包提取 uninstaller。
 * 改用 app-builder-lib 的 UninstallerReader（与 macOS 路径相同），无需 Wine / 图形环境。
 */
async function patchWineVmForUninstallerReader(): Promise<() => void> {
  const { WineVmManager } = requireFromElectronBuilder("app-builder-lib/out/vm/WineVm") as {
    WineVmManager: { prototype: { exec: ExecFn } };
  };
  const { UninstallerReader } = requireFromElectronBuilder(
    "app-builder-lib/out/targets/nsis/nsisUtil",
  ) as {
    UninstallerReader: { exec: (installerPath: string, uninstallerPath: string) => Promise<void> };
  };

  type ExecFn = (file: string, args: string[], options?: unknown) => Promise<unknown>;
  const proto = WineVmManager.prototype as { exec: ExecFn };
  const original = proto.exec;

  proto.exec = async (file: string, args: string[], options?: unknown) => {
    if (process.platform !== "win32" && args.length === 0 && file.toLowerCase().endsWith(".exe")) {
      const uninstallerPath = join(dirname(file), `${basename(file, "exe")}__uninstaller.exe`);
      console.log("[companion] NSIS uninstaller: UninstallerReader（跳过 Wine 跑 Setup 验证）");
      await UninstallerReader.exec(file, uninstallerPath);
      return;
    }
    return original.call(proto, file, args, options);
  };

  return () => {
    proto.exec = original;
  };
}

function shouldPatchNsisUninstallerExtraction(platform: string, profile: BuildProfile): boolean {
  const isWinTarget = platform === "win" || platform === "win32";
  return isWinTarget && profile === "release" && process.platform !== "win32";
}

function buildElectronBuilderOptions(
  platform: string,
  profile: BuildProfile,
  version: string,
): CliOptions {
  const opts: CliOptions = {
    // 版本经 extraMetadata 注入，不修改源码 package.json（避免构建中断后 scripts/devDependencies 丢失）
    config: {
      extends: join(COMPANION_ROOT, "electron-builder.yml"),
      extraMetadata: { version },
    },
    projectDir: COMPANION_ROOT,
  };

  if (profile === "fast") {
    opts.dir = true;
  }

  if (platform === "win" || platform === "win32") {
    opts.win = profile === "release" ? ["nsis"] : [];
    opts.x64 = true;
  } else if (platform === "mac" || platform === "darwin") {
    const arch = process.env.COMPANION_ARCH?.trim();
    opts.mac = profile === "release" ? ["dmg"] : [];
    if (arch === "x64") opts.x64 = true;
    else if (arch === "arm64") opts.arm64 = true;
  } else {
    opts.linux = profile === "release" ? ["AppImage"] : [];
  }

  return opts;
}

async function bundleElectronMain(): Promise<void> {
  rmSync(ELECTRON_DIST, { recursive: true, force: true });
  mkdirSync(ELECTRON_DIST, { recursive: true });

  await esbuild.build(getElectronMainBundleOptions());
  await esbuild.build(getElectronPreloadBundleOptions());
}

function stageFbxBinary(platform: string): void {
  const binDir = join(COMPANION_ROOT, "build-resources", "bin");
  mkdirSync(binDir, { recursive: true });

  if (platform === "win" || platform === "win32") {
    const src = join(FBX_KIT, "FBX2glTF-windows-x64.exe");
    if (!existsSync(src)) {
      throw new Error(`missing ${src}; run bun run setup:fbx in satellites/companion`);
    }
    cpSync(src, join(binDir, "FBX2glTF-windows-x64.exe"));
  }
}

export async function buildCompanionElectron(opts: BuildElectronOptions = {}): Promise<void> {
  const profile = opts.profile ?? resolveProfile();
  const minify = profile === "release";
  const platform = opts.platform ?? process.platform;

  console.log(`[companion] electron build profile=${profile} platform=${platform}`);

  await buildCompanionApp({ minify });
  await bundleElectronMain();
  stageFbxBinary(platform);

  const version = resolveBuildVersion(opts.version);
  console.log(
    `[companion] electron-builder version=${version} (from root package.json or COMPANION_VERSION)`,
  );

  const builderArgs = buildElectronBuilderOptions(platform, profile, version);

  const restoreWineVm = shouldPatchNsisUninstallerExtraction(platform, profile)
    ? await patchWineVmForUninstallerReader()
    : null;
  const prevEnv = { ...process.env };
  Object.assign(process.env, electronBuilderEnv(platform));

  try {
    await runElectronBuilder(builderArgs);
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    restoreWineVm?.();
    for (const key of Object.keys(process.env)) {
      if (!(key in prevEnv)) delete process.env[key];
    }
    Object.assign(process.env, prevEnv);
  }

  console.log("[companion] electron build complete");
}

if (import.meta.main) {
  const version = process.env.COMPANION_VERSION?.trim() || undefined;
  await buildCompanionElectron({
    platform: parsePlatformArg(),
    version,
  });
}
