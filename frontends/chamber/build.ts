import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  buildWebuiToDir,
  resolveWebuiAppDir,
} from "../../platform/connectors/webui/webui-bundle.ts";

const PKG_DIR = import.meta.dir;
const DEFAULT_OUT = join(PKG_DIR, "dist");

export type BuildChamberOptions = {
  outdir?: string;
  minify?: boolean;
};

/** 构建卧室（Chamber）WebUI 静态资源 */
export async function buildChamberApp(opts: BuildChamberOptions = {}): Promise<string> {
  const repoRoot = join(PKG_DIR, "..", "..");
  const outdir = opts.outdir ?? DEFAULT_OUT;
  const minify = opts.minify ?? true;
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const appDir = resolveWebuiAppDir(repoRoot);
  await buildWebuiToDir(appDir, { outdir, minify }, repoRoot);
  return outdir;
}

if (import.meta.main) {
  void buildChamberApp().then((dir) => {
    console.log(`built chamber webui -> ${dir}`);
  });
}
