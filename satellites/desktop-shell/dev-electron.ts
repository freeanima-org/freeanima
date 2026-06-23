import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";

import { buildChatApp } from "@freeanima/satellite-chat/build";
import { buildCompanionApp } from "@freeanima/satellite-companion/build";
import { getElectronMainBundleOptions, getElectronPreloadBundleOptions } from "./build-electron.ts";

const SHELL_ROOT = import.meta.dir;

async function stageVendor(watch: boolean): Promise<void> {
  const companionDist = await buildCompanionApp({ watch, minify: false });
  const chatDist = await buildChatApp({ watch, minify: false });
  for (const [name, src] of [
    ["companion", companionDist],
    ["chat", chatDist],
  ] as const) {
    const dest = join(SHELL_ROOT, "vendor", name, "dist");
    if (!watch) {
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(join(SHELL_ROOT, "vendor", name), { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  }
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

await stageVendor(true);
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
