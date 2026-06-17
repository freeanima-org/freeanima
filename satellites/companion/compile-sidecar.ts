import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "server", "index.ts");
const FBX_CLI_ENTRY = join(import.meta.dir, "server", "fbx2vrma-cli.ts");
const BIN_DIR = join(import.meta.dir, "shell", "src-tauri", "bin");
const SERVER_DIR = join(import.meta.dir, "server");
const FBX_KIT_SRC = join(import.meta.dir, "node_modules", "fbx2vrma-converter");

/** Rust target triple → Bun cross-compile target */
export const SIDECAR_TARGETS = {
  linux: {
    bunTarget: "bun-linux-x64",
    triple: "x86_64-unknown-linux-gnu",
    ext: "",
  },
  win32: {
    bunTarget: "bun-windows-x64",
    triple: "x86_64-pc-windows-gnu",
    ext: ".exe",
  },
  "x86_64-pc-windows-gnu": {
    bunTarget: "bun-windows-x64",
    triple: "x86_64-pc-windows-gnu",
    ext: ".exe",
  },
  "x86_64-unknown-linux-gnu": {
    bunTarget: "bun-linux-x64",
    triple: "x86_64-unknown-linux-gnu",
    ext: "",
  },
  "aarch64-apple-darwin": {
    bunTarget: "bun-darwin-arm64",
    triple: "aarch64-apple-darwin",
    ext: "",
  },
  "x86_64-apple-darwin": {
    bunTarget: "bun-darwin-x64",
    triple: "x86_64-apple-darwin",
    ext: "",
  },
} as const;

export type SidecarTarget = keyof typeof SIDECAR_TARGETS;

const TARGETS: Record<string, { bunTarget: string; triple: string; ext: string }> = SIDECAR_TARGETS;

function resolveTarget(arg?: string): { bunTarget: string; triple: string; ext: string } {
  const key = arg ?? process.platform;
  const found = TARGETS[key];
  if (found) return found;
  throw new Error(`unsupported sidecar target: ${key}`);
}

function collectServerMtimeMs(): number {
  let newest = 0;
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) {
        walk(path);
        continue;
      }
      if (name.endsWith(".ts")) {
        newest = Math.max(newest, st.mtimeMs);
      }
    }
  };
  walk(SERVER_DIR);
  newest = Math.max(newest, statSync(import.meta.path).mtimeMs);
  if (existsSync(FBX_KIT_SRC)) {
    newest = Math.max(newest, statSync(FBX_KIT_SRC).mtimeMs);
  }
  return newest;
}

function isSidecarFresh(outfile: string, fbxOutfile: string): boolean {
  if (!existsSync(outfile) || !existsSync(fbxOutfile)) return false;
  const builtAt = Math.min(statSync(outfile).mtimeMs, statSync(fbxOutfile).mtimeMs);
  return collectServerMtimeMs() <= builtAt;
}

function compileExecutable(entry: string, bunTarget: string, outfile: string): void {
  const proc = Bun.spawnSync(
    ["bun", "build", "--compile", `--target=${bunTarget}`, entry, "--outfile", outfile],
    { cwd: import.meta.dir, stdout: "inherit", stderr: "inherit" },
  );
  if (proc.exitCode !== 0) {
    throw new Error(`compile failed for ${outfile} (exit ${proc.exitCode})`);
  }
}

function fbx2gltfSourceForTriple(triple: string): string | null {
  if (triple.includes("windows")) {
    return join(FBX_KIT_SRC, "FBX2glTF-windows-x64.exe");
  }
  if (triple.includes("apple-darwin")) {
    const darwin = join(FBX_KIT_SRC, "FBX2glTF-darwin-x64");
    return existsSync(darwin) ? darwin : null;
  }
  if (triple.includes("linux")) {
    const linux = join(FBX_KIT_SRC, "FBX2glTF-linux-x64");
    return existsSync(linux) ? linux : null;
  }
  return null;
}

function copyFbx2gltfBinary(triple: string): void {
  const src = fbx2gltfSourceForTriple(triple);
  if (!src || !existsSync(src)) {
    console.warn(
      `[companion] FBX2glTF binary not bundled for ${triple}; FBX import disabled on this target`,
    );
    return;
  }
  const destName = src.endsWith(".exe") ? "FBX2glTF-windows-x64.exe" : basenameFromPath(src);
  const dest = join(BIN_DIR, destName);
  copyFileSync(src, dest);
  console.log(`[companion] copied ${destName} -> ${dest}`);

  // Tauri externalBin：bin/<name>-<triple>.exe → 安装目录 <name>.exe
  if (triple.includes("windows")) {
    const externalBinDest = join(BIN_DIR, `FBX2glTF-windows-x64-${triple}.exe`);
    copyFileSync(src, externalBinDest);
    console.log(`[companion] copied FBX2glTF externalBin -> ${externalBinDest}`);
  }
}

function basenameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? path;
}

export type CompileSidecarOptions = {
  /** 产物比 server/ 新则跳过（本地快速打包） */
  skipIfFresh?: boolean;
};

export async function compileSidecar(
  targetArg?: string,
  opts?: CompileSidecarOptions,
): Promise<string> {
  const { bunTarget, triple, ext } = resolveTarget(targetArg);
  mkdirSync(BIN_DIR, { recursive: true });

  const outfile = join(BIN_DIR, `companion-sidecar-${triple}${ext}`);
  const fbxOutfile = join(BIN_DIR, `fbx2vrma-${triple}${ext}`);

  if (opts?.skipIfFresh && isSidecarFresh(outfile, fbxOutfile)) {
    console.log(`sidecar up-to-date -> ${outfile}`);
    copyFbx2gltfBinary(triple);
    return outfile;
  }

  compileExecutable(ENTRY, bunTarget, outfile);
  console.log(`sidecar compiled -> ${outfile}`);

  compileExecutable(FBX_CLI_ENTRY, bunTarget, fbxOutfile);
  console.log(`fbx2vrma helper compiled -> ${fbxOutfile}`);

  copyFbx2gltfBinary(triple);

  return outfile;
}

if (import.meta.main) {
  const target = process.argv[2];
  const skipIfFresh = process.argv.includes("--skip-if-fresh");
  void compileSidecar(target, { skipIfFresh }).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
