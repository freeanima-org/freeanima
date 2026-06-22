import { spawn } from "node:child_process";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { buildCompanionApp } from "./build.ts";
import { getElectronMainBundleOptions, getElectronPreloadBundleOptions } from "./build-electron.ts";

const COMPANION_ROOT = import.meta.dir;

async function bundleElectron(watch: boolean): Promise<void> {
  const mainCtx = await esbuild.context(getElectronMainBundleOptions());
  const preloadCtx = await esbuild.context(getElectronPreloadBundleOptions());

  if (watch) {
    await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
    return;
  }
  await Promise.all([mainCtx.rebuild(), preloadCtx.rebuild()]);
  await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
}

await buildCompanionApp({ watch: true });
await bundleElectron(true);

const electronBin = join(COMPANION_ROOT, "node_modules", "electron", "cli.js");
const child = spawn(process.execPath, [electronBin, COMPANION_ROOT], {
  cwd: COMPANION_ROOT,
  stdio: "inherit",
  env: {
    ...process.env,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  },
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
