import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildCompanionApp } from "./build.ts";
import { compileSidecar } from "./compile-sidecar.ts";

const WINDOWS_TARGET = "x86_64-pc-windows-gnu";
const TAURI_DIR = join(import.meta.dir, "shell", "src-tauri");
const CARGO_TARGET_DIR = join(import.meta.dir, "shell", "target");

/** fast：本地迭代，优先速度；release：CI/发版，压缩 + NSIS */
type BuildProfile = "fast" | "release";

function resolveProfile(): BuildProfile {
  const raw = process.env.COMPANION_BUILD_PROFILE?.trim().toLowerCase();
  if (raw === "release") return "release";
  return "fast";
}

const profile = resolveProfile();
const minify = profile === "release";
const noBundle = profile === "fast";
const bundles = profile === "release" ? ["nsis"] : [];
const skipSidecarIfFresh = profile === "fast";

console.log(
  `[companion] Windows build profile=${profile} (minify=${minify}, noBundle=${noBundle})`,
);

console.log("[companion] building frontend…");
await buildCompanionApp({ minify });

console.log("[companion] compiling Windows sidecar…");
await compileSidecar(WINDOWS_TARGET, { skipIfFresh: skipSidecarIfFresh });

console.log("[companion] running cargo tauri build…");
const env = {
  ...process.env,
  CARGO_TARGET_DIR,
};
const tauriArgs = ["tauri", "build", "--target", WINDOWS_TARGET];
if (noBundle) {
  tauriArgs.push("--no-bundle");
} else {
  tauriArgs.push("--bundles", ...bundles);
}
const tauri = spawnSync("cargo", tauriArgs, {
  cwd: TAURI_DIR,
  stdio: "inherit",
  env,
});

if (tauri.status !== 0) {
  process.exit(tauri.status ?? 1);
}

if (profile === "release") {
  console.log(
    `[companion] Windows release build complete.\n` +
      `  exe: shell/target/${WINDOWS_TARGET}/release/companion-shell.exe\n` +
      `  installer: shell/target/${WINDOWS_TARGET}/release/bundle/nsis/`,
  );
} else {
  console.log(
    `[companion] Windows fast build complete.\n` +
      `  exe: shell/target/${WINDOWS_TARGET}/release/companion-shell.exe\n` +
      `  tip: bun run build:windows:installer  # NSIS + minify（CI 发版）`,
  );
}
