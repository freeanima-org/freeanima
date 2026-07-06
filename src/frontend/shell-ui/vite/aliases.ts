import { join } from "node:path";
import type { Alias, Plugin } from "vite";

import { shellSourcePaths } from "./paths.ts";

function isCompanionAppImporter(importer: string | undefined): boolean {
  return importer?.replaceAll("\\", "/").includes("src/satellites/companion/spa/") ?? false;
}

/** companion app 内 `@/` 路径重写（Vite 8 替代 customResolver） */
export function companionAtAliasPlugin(root?: string): Plugin {
  const paths = shellSourcePaths(root);
  const shellPrefix = `${paths.shell}/`;

  return {
    name: "companion-at-alias",
    enforce: "pre",
    resolveId(source, importer) {
      if (!isCompanionAppImporter(importer)) return null;
      if (source.startsWith(shellPrefix)) {
        return join(paths.companionApp, source.slice(shellPrefix.length));
      }
      if (source.startsWith("@/")) {
        return join(paths.companionApp, source.slice(2));
      }
      return null;
    },
  };
}

export function createShellUiAliases(paraglideDir: string, root?: string): Alias[] {
  const paths = shellSourcePaths(root);
  return [
    { find: "@paraglide/messages", replacement: join(paraglideDir, "messages.js") },
    { find: "@paraglide/runtime", replacement: join(paraglideDir, "runtime.js") },
    { find: /^@chat\/(.*)$/, replacement: `${paths.chat}/$1` },
    { find: /^@console\/(.*)$/, replacement: `${paths.console}/$1` },
    { find: /^@task\/(.*)$/, replacement: `${paths.task}/$1` },
    { find: /^@shared\/(.*)$/, replacement: `${paths.companionShared}/$1` },
    { find: /^@\/(.*)$/, replacement: `${paths.shell}/$1` },
    { find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` },
  ];
}
