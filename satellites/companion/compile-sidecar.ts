import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ENTRY = join(import.meta.dir, "server", "index.ts");
const BIN_DIR = join(import.meta.dir, "shell", "src-tauri", "bin");
const SERVER_DIR = join(import.meta.dir, "server");

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
  return newest;
}

function isSidecarFresh(outfile: string): boolean {
  if (!existsSync(outfile)) return false;
  const builtAt = statSync(outfile).mtimeMs;
  return collectServerMtimeMs() <= builtAt;
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

  if (opts?.skipIfFresh && isSidecarFresh(outfile)) {
    console.log(`sidecar up-to-date -> ${outfile}`);
    return outfile;
  }

  const proc = Bun.spawnSync(
    ["bun", "build", "--compile", `--target=${bunTarget}`, ENTRY, "--outfile", outfile],
    { cwd: import.meta.dir, stdout: "inherit", stderr: "inherit" },
  );

  if (proc.exitCode !== 0) {
    throw new Error(`sidecar compile failed (exit ${proc.exitCode})`);
  }

  console.log(`sidecar compiled -> ${outfile}`);
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
