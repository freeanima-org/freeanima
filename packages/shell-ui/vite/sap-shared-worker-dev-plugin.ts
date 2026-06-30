import type { Plugin, ViteDevServer } from "vite";

import { shellSourcePaths } from "./paths.ts";

const WORKER_URL = "/sap-shared-worker.js";
const VIRTUAL_ID = "\0sap-shared-worker-dev";

function serveTransformedWorker(server: ViteDevServer): void {
  server.middlewares.use((req, res, next) => {
    void (async () => {
      if (req.url?.split("?")[0] !== WORKER_URL) {
        next();
        return;
      }
      try {
        const result = await server.transformRequest(WORKER_URL);
        if (!result?.code) {
          next();
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript");
        res.end(result.code);
      } catch (err) {
        next(err instanceof Error ? err : new Error(String(err)));
      }
    })().catch(next);
  });
}

/** dev：将 /sap-shared-worker.js 经 Vite 变换后提供（与 build 入口同源码） */
export function sapSharedWorkerDevPlugin(repoRoot?: string): Plugin {
  const workerEntry = shellSourcePaths(repoRoot).sapWorkerEntry;
  return {
    name: "sap-shared-worker-dev",
    apply: "serve",
    resolveId(id) {
      if (id === WORKER_URL) return VIRTUAL_ID;
    },
    load(id) {
      if (id === VIRTUAL_ID) {
        return `import ${JSON.stringify(workerEntry)};`;
      }
    },
    configureServer(server) {
      serveTransformedWorker(server);
    },
  };
}
