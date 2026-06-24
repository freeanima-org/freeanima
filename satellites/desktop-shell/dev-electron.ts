import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import * as esbuild from "esbuild";

import { buildChamberApp } from "@freeanima/frontend-chamber/build";
import { buildChatApp } from "@freeanima/satellite-chat/build";
import { buildCompanionApp } from "@freeanima/satellite-companion/build";
import { getElectronMainBundleOptions, getElectronPreloadBundleOptions } from "./build-electron.ts";

const SHELL_ROOT = import.meta.dir;

async function stageVendor(): Promise<void> {
  await Promise.all([
    buildCompanionApp({ watch: true, minify: false }),
    buildChatApp({ watch: true, minify: false }),
    buildChamberApp({ minify: false }),
  ]);
}

async function bundleElectron(watch: boolean): Promise<void> {
  const mainCtx = await esbuild.context(getElectronMainBundleOptions());
  const preloadCtx = await esbuild.context(getElectronPreloadBundleOptions());
  await Promise.all([mainCtx.rebuild(), preloadCtx.rebuild()]);
  if (watch) {
    await Promise.all([mainCtx.watch(), preloadCtx.watch()]);
    return;
  }
  await Promise.all([mainCtx.dispose(), preloadCtx.dispose()]);
}

await stageVendor();
await bundleElectron(true);

const requireFromShell = createRequire(join(SHELL_ROOT, "package.json"));
const electronPath = requireFromShell("electron") as string;

const electronEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
};
delete electronEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [SHELL_ROOT], {
  cwd: SHELL_ROOT,
  stdio: "inherit",
  env: electronEnv,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
