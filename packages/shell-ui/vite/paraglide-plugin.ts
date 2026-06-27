import { join } from "node:path";
import { compileParaglideToDir } from "@freeanima/admin-frontend/paraglide-compile";
import type { Plugin, ViteDevServer } from "vite";

import { REPO_ROOT } from "./paths.ts";

const MESSAGE_CATALOG_FILES = ["messages/en.json", "messages/zh-cn.json"] as const;

function messageCatalogPaths(projectRoot: string): string[] {
  return MESSAGE_CATALOG_FILES.map((rel) => join(projectRoot, rel));
}

function invalidateParaglideModules(server: ViteDevServer, paraglideDir: string): void {
  const files = [
    join(paraglideDir, "messages.js"),
    join(paraglideDir, "runtime.js"),
    join(paraglideDir, "messages", "_index.js"),
  ];
  for (const file of files) {
    for (const mod of server.moduleGraph.getModulesByFile(file) ?? []) {
      server.moduleGraph.invalidateModule(mod);
    }
  }
}

/** 构建前编译 Paraglide 到 outDir/.paraglide */
export function paraglideCompilePlugin(paraglideDir: string, projectRoot = REPO_ROOT): Plugin {
  const compile = (): void => {
    compileParaglideToDir({ projectRoot, outdir: paraglideDir });
  };

  return {
    name: "shell-ui-paraglide",
    config() {
      compile();
    },
    buildStart() {
      compile();
    },
    configureServer(server) {
      const catalogs = messageCatalogPaths(projectRoot);
      for (const path of catalogs) {
        server.watcher.add(path);
      }
      const onCatalogChange = (changedPath: string): void => {
        if (!catalogs.includes(changedPath)) return;
        compile();
        invalidateParaglideModules(server, paraglideDir);
        server.ws.send({ type: "full-reload", path: "*" });
      };
      server.watcher.on("change", onCatalogChange);
      server.watcher.on("add", onCatalogChange);
    },
  };
}
