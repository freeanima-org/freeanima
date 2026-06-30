import { join } from "node:path";
import type { Plugin } from "vite";

/** Vite 构建时将 sap-contract 的 stub 解析为带 ?sharedworker&url 的版本 */
export function sapSharedWorkerBundledUrlPlugin(repoRoot: string): Plugin {
  const viteModule = join(
    repoRoot,
    "packages",
    "sap-contract",
    "src",
    "shared-worker-bundled-url.vite.ts",
  );
  return {
    name: "sap-shared-worker-bundled-url",
    resolveId(source, importer) {
      if (!importer?.includes("sap-contract")) return null;
      if (
        source === "./shared-worker-bundled-url.ts" ||
        source.endsWith("/shared-worker-bundled-url.ts")
      ) {
        return viteModule;
      }
      return null;
    },
  };
}
