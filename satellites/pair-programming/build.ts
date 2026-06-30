import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runSatelliteViteBuild,
  type SatelliteViteOptions,
} from "../../packages/shell-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..");
const APP_DIR = join(PKG_DIR, "app");
const DIST_DIR = join(PKG_DIR, "dist");

function pairViteBuildOptions(overrides?: Partial<SatelliteViteOptions>): SatelliteViteOptions {
  return {
    appDir: APP_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    paraglide: true,
    aliases: [{ find: /^@pair\/(.*)$/, replacement: `${join(APP_DIR, "src")}/$1` }],
    ...overrides,
  };
}

/** 程序化构建（watch 等）；CLI 用 `vite build` */
export async function buildPairProgrammingApp(opts?: {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<string> {
  return runSatelliteViteBuild(
    pairViteBuildOptions({
      minify: opts?.minify ?? false,
      sourcemap: opts?.sourcemap ?? false,
      ...(opts?.watch !== undefined ? { watch: opts.watch } : {}),
    }),
  );
}
