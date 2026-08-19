import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { getShellBuildTarget } from "@freeanima/client/portal-sdk/shell-build-target.ts";
import {
  runSatelliteViteBuild,
  type SatelliteViteOptions,
} from "../../client/app-frame/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "ui", "float");
const DIST_DIR = join(PKG_DIR, "dist-float");

function floatViteBuildOptions(overrides?: Partial<SatelliteViteOptions>): SatelliteViteOptions {
  return {
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    base: "./",
    ...overrides,
  };
}

/** 程序化构建番茄迷你窗；仅 desktop。 */
export async function buildPomodoroFloatApp(opts?: {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<string> {
  if (getShellBuildTarget() !== "desktop") {
    throw new Error(
      `buildPomodoroFloatApp requires FREEANIMA_SHELL_TARGET=desktop (got ${getShellBuildTarget()})`,
    );
  }
  return runSatelliteViteBuild(
    floatViteBuildOptions({
      minify: opts?.minify ?? false,
      sourcemap: opts?.sourcemap ?? false,
      ...(opts?.watch !== undefined ? { watch: opts.watch } : {}),
    }),
  );
}
