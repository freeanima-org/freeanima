import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildCompanionApp } from "./build.ts";
import { prepareSidecarBundle, type SidecarTarget } from "./prepare-sidecar.ts";

const TAURI_DIR = join(import.meta.dir, "shell", "src-tauri");
const CARGO_TARGET_DIR = join(import.meta.dir, "shell", "target");
const TAURI_CONF = join(TAURI_DIR, "tauri.conf.json");

/** fast：本地迭代；release：CI/发版（minify + 安装包） */
export type BuildProfile = "fast" | "release";

type TargetSpec = {
  label: string;
  bundles: { release: string[]; fast: string[] };
  postBuild?: (releaseDir: string) => void;
  verify?: (releaseDir: string, profile: BuildProfile) => void;
};

const TARGETS: Record<string, TargetSpec> = {
  "x86_64-pc-windows-gnu": {
    label: "Windows x64",
    bundles: { release: ["nsis"], fast: [] },
    postBuild: (releaseDir) => {
      ensureWebview2LoaderDll(releaseDir);
      ensureFbxConverterRuntime(releaseDir, "x86_64-pc-windows-gnu");
    },
    verify: verifyWindowsRelease,
  },
  "aarch64-apple-darwin": {
    label: "macOS Apple Silicon",
    bundles: { release: ["dmg"], fast: [] },
    verify: verifyMacosRelease,
  },
  "x86_64-apple-darwin": {
    label: "macOS Intel",
    bundles: { release: ["dmg"], fast: [] },
    verify: verifyMacosRelease,
  },
};

export function resolveProfile(): BuildProfile {
  const raw = process.env.COMPANION_BUILD_PROFILE?.trim().toLowerCase();
  if (raw === "release") return "release";
  return "fast";
}

function parseTargetArg(): string {
  const idx = process.argv.indexOf("--target");
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1]!;
  }
  const env = process.env.TAURI_TARGET?.trim();
  if (env) return env;
  throw new Error("missing --target (e.g. x86_64-pc-windows-gnu, aarch64-apple-darwin)");
}

function resolveTarget(targetArg: string): TargetSpec & { triple: string } {
  const spec = TARGETS[targetArg];
  if (!spec) {
    throw new Error(
      `unsupported tauri target: ${targetArg}\n` + `supported: ${Object.keys(TARGETS).join(", ")}`,
    );
  }
  return { ...spec, triple: targetArg };
}

function applyVersion(version: string): void {
  const normalized = version.replace(/^v/i, "");
  const conf = JSON.parse(readFileSync(TAURI_CONF, "utf-8")) as { version?: string };
  conf.version = normalized;
  writeFileSync(TAURI_CONF, `${JSON.stringify(conf, null, 2)}\n`);
}

function findWebview2LoaderDll(root: string): string | null {
  if (!existsSync(root)) return null;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      const nested = findWebview2LoaderDll(path);
      if (nested) return nested;
      continue;
    }
    if (name === "WebView2Loader.dll" && path.includes(`${join("out", "x64")}`)) {
      return path;
    }
  }
  return null;
}

function verifySidecarBundlePresent(triple: string): void {
  const stagingEntry = join(TAURI_DIR, "resources", "sidecar", "server", "index.ts");
  if (!existsSync(stagingEntry)) {
    throw new Error(`missing sidecar bundle: ${stagingEntry} — run prepare-sidecar first`);
  }
  const bunBin = join(
    TAURI_DIR,
    "bin",
    `companion-bun-${triple}${triple.includes("windows") ? ".exe" : ""}`,
  );
  if (!existsSync(bunBin)) {
    throw new Error(`missing companion-bun: ${bunBin}`);
  }
}

function ensureFbxConverterRuntime(releaseDir: string, triple: string): void {
  const binDir = join(import.meta.dir, "shell", "src-tauri", "bin");
  const fbx2gltfName = triple.includes("windows") ? "FBX2glTF-windows-x64.exe" : null;
  if (!fbx2gltfName) return;

  const dest = join(releaseDir, fbx2gltfName);
  if (existsSync(dest)) return;

  const srcCandidates = [
    join(binDir, fbx2gltfName),
    join(binDir, `FBX2glTF-windows-x64-${triple}.exe`),
  ];
  for (const src of srcCandidates) {
    if (existsSync(src)) {
      copyFileSync(src, dest);
      console.log(`[companion] copied ${fbx2gltfName} -> ${dest}`);
      return;
    }
  }
}

function ensureWebview2LoaderDll(releaseDir: string): void {
  const dllPath = join(releaseDir, "WebView2Loader.dll");
  if (existsSync(dllPath)) {
    console.log(`[companion] WebView2Loader.dll present -> ${dllPath}`);
    return;
  }

  const source = findWebview2LoaderDll(join(releaseDir, "build"));
  if (!source) {
    throw new Error(
      "WebView2Loader.dll not found after build. GNU Windows builds require this DLL beside companion-shell.exe.",
    );
  }

  copyFileSync(source, dllPath);
  console.log(`[companion] copied WebView2Loader.dll -> ${dllPath}`);
}

function verifyWindowsRelease(releaseDir: string, profile: BuildProfile): void {
  const required = [
    join(releaseDir, "companion-shell.exe"),
    join(releaseDir, "WebView2Loader.dll"),
    join(releaseDir, "companion-bun.exe"),
    join(releaseDir, "FBX2glTF-windows-x64.exe"),
  ];
  for (const path of required) {
    if (!existsSync(path)) {
      throw new Error(`missing Windows runtime file: ${path}`);
    }
  }

  if (profile === "release") {
    const nsisDir = join(releaseDir, "bundle", "nsis");
    if (!existsSync(nsisDir) || readdirSync(nsisDir).length === 0) {
      throw new Error(`missing NSIS installer in ${nsisDir}`);
    }
  }
}

function verifyMacosRelease(releaseDir: string, profile: BuildProfile): void {
  const binary = join(releaseDir, "companion-shell");
  if (!existsSync(binary)) {
    throw new Error(`missing macOS binary: ${binary}`);
  }

  if (profile === "release") {
    const dmgDir = join(releaseDir, "bundle", "dmg");
    if (!existsSync(dmgDir) || readdirSync(dmgDir).every((name) => !name.endsWith(".dmg"))) {
      throw new Error(`missing DMG bundle in ${dmgDir}`);
    }
  }
}

function printSummary(target: TargetSpec & { triple: string }, profile: BuildProfile): void {
  const rel = `shell/target/${target.triple}/release`;
  if (target.triple.endsWith("-pc-windows-gnu")) {
    if (profile === "release") {
      console.log(
        `[companion] ${target.label} release build complete.\n` +
          `  exe: ${rel}/companion-shell.exe\n` +
          `  installer: ${rel}/bundle/nsis/`,
      );
      return;
    }
    console.log(
      `[companion] ${target.label} fast build complete.\n` +
        `  exe: ${rel}/companion-shell.exe\n` +
        `  tip: COMPANION_BUILD_PROFILE=release bun build-tauri.ts --target ${target.triple}`,
    );
    return;
  }

  if (profile === "release") {
    console.log(
      `[companion] ${target.label} release build complete.\n` +
        `  app: ${rel}/bundle/macos/\n` +
        `  dmg: ${rel}/bundle/dmg/`,
    );
    return;
  }
  console.log(
    `[companion] ${target.label} fast build complete.\n` +
      `  binary: ${rel}/companion-shell\n` +
      `  tip: COMPANION_BUILD_PROFILE=release bun build-tauri.ts --target ${target.triple}`,
  );
}

export type BuildCompanionTauriOptions = {
  target: string;
  profile?: BuildProfile;
  version?: string;
};

export async function buildCompanionTauri(opts: BuildCompanionTauriOptions): Promise<void> {
  const target = resolveTarget(opts.target);
  const profile = opts.profile ?? resolveProfile();
  const minify = profile === "release";
  const noBundle = profile === "fast";
  const bundles = profile === "release" ? target.bundles.release : target.bundles.fast;
  const skipSidecarIfFresh = profile === "fast";
  const releaseDir = join(CARGO_TARGET_DIR, target.triple, "release");

  if (opts.version) {
    applyVersion(opts.version);
  }

  console.log(
    `[companion] ${target.label} build profile=${profile} target=${target.triple} (minify=${minify}, noBundle=${noBundle})`,
  );

  console.log("[companion] building frontend…");
  await buildCompanionApp({ minify });

  console.log(`[companion] preparing sidecar bundle for ${target.triple}…`);
  await prepareSidecarBundle(opts.target as SidecarTarget, { skipIfFresh: skipSidecarIfFresh });
  verifySidecarBundlePresent(target.triple);

  console.log("[companion] running cargo tauri build…");
  const tauriArgs = ["tauri", "build", "--target", target.triple];
  if (noBundle) {
    tauriArgs.push("--no-bundle");
  } else {
    tauriArgs.push("--bundles", ...bundles);
  }

  const tauri = spawnSync("cargo", tauriArgs, {
    cwd: TAURI_DIR,
    stdio: "inherit",
    env: {
      ...process.env,
      CARGO_TARGET_DIR,
    },
  });

  if (tauri.status !== 0) {
    process.exit(tauri.status ?? 1);
  }

  target.postBuild?.(releaseDir);
  target.verify?.(releaseDir, profile);
  printSummary(target, profile);
}

if (import.meta.main) {
  const version = process.env.COMPANION_VERSION?.trim() || undefined;
  await buildCompanionTauri({
    target: parseTargetArg(),
    version,
  });
}
