import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runSatelliteViteBuild,
  type SatelliteViteOptions,
} from "../../frontend/shell-ui/vite/satellite-vite.ts";

const PKG_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(PKG_DIR, "..", "..", "..");
const SPA_DIR = join(PKG_DIR, "spa");
const DIST_DIR = join(PKG_DIR, "dist");

function companionViteBuildOptions(
  overrides?: Partial<SatelliteViteOptions>,
): SatelliteViteOptions {
  return {
    appDir: SPA_DIR,
    repoRoot: REPO_ROOT,
    outdir: DIST_DIR,
    aliases: [
      { find: /^@\/(.*)$/, replacement: `${join(SPA_DIR)}/$1` },
      { find: /^@shared\/(.*)$/, replacement: `${join(PKG_DIR, "shared")}/$1` },
    ],
    ...overrides,
  };
}

/** 程序化构建（desktop vendor）；CLI 用 `vite build` */
export async function buildCompanionApp(opts?: {
  watch?: boolean;
  minify?: boolean;
  sourcemap?: boolean;
}): Promise<string> {
  return runSatelliteViteBuild(
    companionViteBuildOptions({
      minify: opts?.minify ?? false,
      sourcemap: opts?.sourcemap ?? false,
      ...(opts?.watch !== undefined ? { watch: opts.watch } : {}),
    }),
  );
}
