import { readdirSync } from "node:fs";
import { join } from "node:path";
import { compileParaglideToDir } from "../../../features/console/build/paraglide-compile.ts";
import type { Plugin, ViteDevServer } from "vite";

import { REPO_ROOT } from "./paths.ts";

const MESSAGE_CATALOG_FILES = ["messages/en.json", "messages/zh-cn.json"] as const;

function messageCatalogPaths(projectRoot: string): string[] {
  return MESSAGE_CATALOG_FILES.map((rel) => join(projectRoot, rel));
}

function paraglideOutputFiles(paraglideDir: string): string[] {
  const files = [
    join(paraglideDir, "messages.js"),
    join(paraglideDir, "runtime.js"),
    join(paraglideDir, "registry.js"),
    join(paraglideDir, "server.js"),
    join(paraglideDir, "messages", "_index.js"),
  ];
  const messagesDir = join(paraglideDir, "messages");
  try {
    for (const name of readdirSync(messagesDir)) {
      if (name.endsWith(".js")) {
        files.push(join(messagesDir, name));
      }
    }
  } catch {
    /* messages dir may not exist yet */
  }
  return files;
}

function invalidateParaglideModules(server: ViteDevServer, paraglideDir: string): void {
  const seen = new Set<string>();
  for (const file of paraglideOutputFiles(paraglideDir)) {
    for (const mod of server.moduleGraph.getModulesByFile(file) ?? []) {
      if (seen.has(mod.id ?? file)) continue;
      seen.add(mod.id ?? file);
      server.moduleGraph.invalidateModule(mod);
    }
  }
  for (const mod of server.moduleGraph.getModulesByFile(join(paraglideDir, "messages.js")) ?? []) {
    server.moduleGraph.invalidateModule(mod);
  }
}

/** 构建前编译 Paraglide 到 outDir/.paraglide（或 paraglideOutdir） */
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
        const normalized = changedPath.replaceAll("\\", "/");
        const matched = catalogs.some((catalog) =>
          normalized.endsWith(catalog.replaceAll("\\", "/")),
        );
        if (!matched) return;
        compile();
        invalidateParaglideModules(server, paraglideDir);
        server.ws.send({ type: "full-reload", path: "*" });
      };
      server.watcher.on("change", onCatalogChange);
      server.watcher.on("add", onCatalogChange);
    },
  };
}
