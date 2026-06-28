import type { Plugin } from "vite";

import { buildSapSharedWorkerBundle, type ShellViteBuildOptions } from "./run-build.ts";

/** production：单独打包 sap-shared-worker.js（inlineDynamicImports，避免 SharedWorker 加载含 document 的 chunk） */
export function sapSharedWorkerBuildPlugin(
  opts: Pick<
    ShellViteBuildOptions,
    "appDir" | "outdir" | "repoRoot" | "minify" | "sourcemap" | "paraglideOutdir"
  >,
): Plugin {
  return {
    name: "sap-shared-worker-build",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      await buildSapSharedWorkerBundle(opts);
    },
  };
}
