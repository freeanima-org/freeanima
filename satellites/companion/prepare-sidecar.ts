import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

const COMPANION_ROOT = import.meta.dir;
const REPO_ROOT = join(COMPANION_ROOT, "..", "..");
const TAURI_DIR = join(COMPANION_ROOT, "shell", "src-tauri");
const BIN_DIR = join(TAURI_DIR, "bin");
const STAGING_DIR = join(TAURI_DIR, "resources", "sidecar");
const FBX_KIT_SRC = join(COMPANION_ROOT, "node_modules", "fbx2vrma-converter");
const SAP_CONTRACT_SRC = join(REPO_ROOT, "packages", "sap-contract");

/** Rust target triple → Bun 运行时平台 */
export const SIDECAR_TARGETS = {
  linux: {
    triple: "x86_64-unknown-linux-gnu",
    ext: "",
  },
  win32: {
    triple: "x86_64-pc-windows-gnu",
    ext: ".exe",
  },
  "x86_64-pc-windows-gnu": {
    triple: "x86_64-pc-windows-gnu",
    ext: ".exe",
  },
  "x86_64-unknown-linux-gnu": {
    triple: "x86_64-unknown-linux-gnu",
    ext: "",
  },
  "aarch64-apple-darwin": {
    triple: "aarch64-apple-darwin",
    ext: "",
  },
  "x86_64-apple-darwin": {
    triple: "x86_64-apple-darwin",
    ext: "",
  },
} as const;

export type SidecarTarget = keyof typeof SIDECAR_TARGETS;

/** 从 workspace catalog 解析依赖版本 */
function resolveDependencyVersion(
  pkg: { dependencies?: Record<string, string> },
  name: string,
): string {
  const direct = pkg.dependencies?.[name];
  if (direct && direct !== "catalog:") return direct;
  const rootPkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf-8")) as {
    workspaces?: { catalog?: Record<string, string> };
  };
  const fromCatalog = rootPkg.workspaces?.catalog?.[name];
  if (!fromCatalog) {
    throw new Error(`无法解析 sidecar 依赖 ${name}（package.json / catalog）`);
  }
  return fromCatalog;
}

/** staging 内 bun install 生产依赖 + 复制 workspace sap-contract */
function installRuntimeModules(): void {
  const companionPkg = JSON.parse(readFileSync(join(COMPANION_ROOT, "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
  };

  writeFileSync(
    join(STAGING_DIR, "package.json"),
    `${JSON.stringify(
      {
        name: "companion-sidecar-runtime",
        private: true,
        type: "module",
        dependencies: {
          "fbx2vrma-converter": resolveDependencyVersion(companionPkg, "fbx2vrma-converter"),
          zod: resolveDependencyVersion(companionPkg, "zod"),
        },
      },
      null,
      2,
    )}\n`,
  );

  const install = Bun.spawnSync(["bun", "install", "--production"], {
    cwd: STAGING_DIR,
    stdout: "inherit",
    stderr: "inherit",
  });
  if (install.exitCode !== 0) {
    throw new Error(`sidecar runtime bun install failed (exit ${install.exitCode})`);
  }

  const zodPkg = join(STAGING_DIR, "node_modules", "zod", "package.json");
  if (!existsSync(zodPkg)) {
    throw new Error(`sidecar bundle 缺少 zod（${zodPkg}）`);
  }

  const sapDest = join(STAGING_DIR, "node_modules", "@freeanima", "sap-contract");
  mkdirSync(join(STAGING_DIR, "node_modules", "@freeanima"), { recursive: true });
  if (!existsSync(SAP_CONTRACT_SRC)) {
    throw new Error(`missing @freeanima/sap-contract at ${SAP_CONTRACT_SRC}`);
  }
  cpSync(SAP_CONTRACT_SRC, sapDest, { recursive: true });
}

function copyServerTree(): void {
  const serverSrc = join(COMPANION_ROOT, "server");
  const serverDest = join(STAGING_DIR, "server");
  rmSync(serverDest, { recursive: true, force: true });
  cpSync(serverSrc, serverDest, {
    recursive: true,
    filter: (src) => {
      const base = src.split(/[/\\]/).pop() ?? "";
      if (base.endsWith(".test.ts")) return false;
      if (src.includes("/tools") || src.includes("\\tools")) return false;
      return true;
    },
  });
}

function copySharedTree(): void {
  const sharedSrc = join(COMPANION_ROOT, "shared");
  const sharedDest = join(STAGING_DIR, "shared");
  rmSync(sharedDest, { recursive: true, force: true });
  cpSync(sharedSrc, sharedDest, { recursive: true });
}

const BUN_VERSION = "1.3.14";

type BunRelease = {
  archiveName: string;
  binPathInArchive: string;
};

function bunReleaseForTriple(triple: string): BunRelease {
  if (triple.includes("windows")) {
    return { archiveName: `bun-windows-x64.zip`, binPathInArchive: "bun-windows-x64/bun.exe" };
  }
  if (triple.includes("apple-darwin")) {
    if (triple.startsWith("aarch64")) {
      return { archiveName: "bun-darwin-aarch64.zip", binPathInArchive: "bun-darwin-aarch64/bun" };
    }
    return { archiveName: "bun-darwin-x64.zip", binPathInArchive: "bun-darwin-x64/bun" };
  }
  return { archiveName: "bun-linux-x64.zip", binPathInArchive: "bun-linux-x64/bun" };
}

function externalBinName(triple: string): string {
  const ext = triple.includes("windows") ? ".exe" : "";
  return `companion-bun-${triple}${ext}`;
}

async function downloadBunBinary(triple: string): Promise<void> {
  const { archiveName, binPathInArchive } = bunReleaseForTriple(triple);
  const url = `https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${archiveName}`;
  const cacheDir = join(COMPANION_ROOT, ".cache", "bun-release");
  const zipPath = join(cacheDir, archiveName);
  mkdirSync(cacheDir, { recursive: true });

  if (!existsSync(zipPath)) {
    console.log(`[companion] downloading ${url}…`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`failed to download bun ${BUN_VERSION} for ${triple}: ${res.status}`);
    }
    writeFileSync(zipPath, new Uint8Array(await res.arrayBuffer()));
  }

  const extractDir = join(cacheDir, archiveName.replace(/\.zip$/, ""));
  const srcBin = join(extractDir, ...binPathInArchive.split("/"));
  if (!existsSync(srcBin)) {
    rmSync(extractDir, { recursive: true, force: true });
    mkdirSync(extractDir, { recursive: true });
    const proc = Bun.spawnSync(["unzip", "-q", zipPath, "-d", extractDir], {
      cwd: cacheDir,
      stdout: "inherit",
      stderr: "inherit",
    });
    if (proc.exitCode !== 0) {
      throw new Error(`unzip failed for ${zipPath} (exit ${proc.exitCode})`);
    }
  }

  if (!existsSync(srcBin)) {
    throw new Error(`bun binary not found in archive: ${srcBin}`);
  }

  mkdirSync(BIN_DIR, { recursive: true });
  const dest = join(BIN_DIR, externalBinName(triple));
  copyFileSync(srcBin, dest);
  if (!triple.includes("windows")) {
    Bun.spawnSync(["chmod", "+x", dest]);
  }
  console.log(`[companion] companion-bun -> ${dest}`);
}

function copyFbx2gltfBinary(triple: string): void {
  if (!triple.includes("windows")) return;
  const src = join(FBX_KIT_SRC, "FBX2glTF-windows-x64.exe");
  if (!existsSync(src)) {
    throw new Error(
      `missing FBX2glTF-windows-x64.exe in fbx2vrma-converter; run bun install in satellites/companion`,
    );
  }
  mkdirSync(BIN_DIR, { recursive: true });
  const plain = join(BIN_DIR, "FBX2glTF-windows-x64.exe");
  const external = join(BIN_DIR, `FBX2glTF-windows-x64-${triple}.exe`);
  copyFileSync(src, plain);
  copyFileSync(src, external);
  console.log(`[companion] FBX2glTF -> ${external}`);
}

export type PrepareSidecarOptions = {
  skipIfFresh?: boolean;
};

function stagingMarker(): string {
  return join(STAGING_DIR, ".prepare-marker");
}

function isStagingFresh(triple: string): boolean {
  const marker = stagingMarker();
  if (!existsSync(marker)) return false;
  const markerMtime = statSync(marker).mtimeMs;
  const serverIndex = join(COMPANION_ROOT, "server", "index.ts");
  if (existsSync(serverIndex) && statSync(serverIndex).mtimeMs > markerMtime) return false;
  const bunBin = join(BIN_DIR, externalBinName(triple));
  return (
    existsSync(bunBin) &&
    existsSync(join(STAGING_DIR, "server", "index.ts")) &&
    existsSync(join(STAGING_DIR, "shared", "motion-manifest.json")) &&
    existsSync(join(STAGING_DIR, "node_modules", "zod", "package.json"))
  );
}

export async function prepareSidecarBundle(
  targetArg?: string,
  opts?: PrepareSidecarOptions,
): Promise<string> {
  const key = targetArg ?? process.platform;
  const spec = SIDECAR_TARGETS[key as SidecarTarget];
  if (!spec) {
    throw new Error(`unsupported sidecar target: ${key}`);
  }
  const { triple } = spec;

  if (opts?.skipIfFresh && isStagingFresh(triple)) {
    console.log(`[companion] sidecar bundle up-to-date (${triple})`);
    copyFbx2gltfBinary(triple);
    return join(BIN_DIR, externalBinName(triple));
  }

  console.log(`[companion] preparing sidecar bundle for ${triple}…`);
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });

  copyServerTree();
  copySharedTree();
  installRuntimeModules();

  await downloadBunBinary(triple);
  copyFbx2gltfBinary(triple);

  writeFileSync(
    stagingMarker(),
    `${new Date().toISOString()}\n${readFileSync(join(COMPANION_ROOT, "package.json"), "utf-8").slice(0, 80)}\n`,
  );

  console.log(`[companion] sidecar bundle ready -> ${STAGING_DIR}`);
  return join(BIN_DIR, externalBinName(triple));
}

if (import.meta.main) {
  const target = process.argv[2];
  const skipIfFresh = process.argv.includes("--skip-if-fresh");
  void prepareSidecarBundle(target, { skipIfFresh }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
