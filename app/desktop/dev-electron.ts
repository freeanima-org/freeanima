import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";
import { createServer as createViteServer } from "vite";
import * as esbuild from "esbuild";

import { getElectronMainBundleOptions, getElectronPreloadBundleOptions } from "./build-electron.ts";

const SHELL_ROOT = import.meta.dir;
const SHELL_VITE_PORT = Number(process.env.DESKTOP_SHELL_VITE_PORT ?? 5173);

async function startShellViteDev(): Promise<string> {
  const vite = await createViteServer({
    configFile: join(SHELL_ROOT, "vite.config.ts"),
  });
  await vite.listen(SHELL_VITE_PORT);
  const url =
    vite.resolvedUrls?.local[0]?.replace(/\/$/, "") ?? `http://127.0.0.1:${SHELL_VITE_PORT}`;
  console.log(`[dev:electron] shell-ui Vite ${url}`);
  return url;
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

process.env.DESKTOP_VITE_DEV = "1";
process.env.DESKTOP_SHELL_VITE_URL = await startShellViteDev();

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
