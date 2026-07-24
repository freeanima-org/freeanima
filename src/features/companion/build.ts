import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getShellBuildTarget } from "@freeanima/frontend/portal-sdk/shell-build-target.ts";
import {
  runSatelliteViteBuild,
  type SatelliteViteOptions,
} from "../../frontend/app-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "ui", "spa");
const DIST_DIR = join(PKG_DIR, "dist");

function companionViteBuildOptions(
  overrides?: Partial<SatelliteViteOptions>,
): SatelliteViteOptions {
  return {
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    // `./`：HTTP 与 Tauri file:// resource 均可解析；勿用绝对 `/`
    base: "./",
    ...overrides,
  };
}

/** 程序化构建（desktop vendor）；CLI 用 `vite build`。仅 desktop 壳目标。 */
export async function buildCompanionApp(opts?: {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<string> {
  if (getShellBuildTarget() !== "desktop") {
    throw new Error(
      `buildCompanionApp requires FREEANIMA_SHELL_TARGET=desktop (got ${getShellBuildTarget()})`,
    );
  }
  return runSatelliteViteBuild(
    companionViteBuildOptions({
      minify: opts?.minify ?? false,
      sourcemap: opts?.sourcemap ?? false,
      ...(opts?.watch !== undefined ? { watch: opts.watch } : {}),
    }),
  );
}
