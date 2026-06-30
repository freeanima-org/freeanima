import { join } from "node:path";
import type { Alias, AliasOptions } from "vite";

import { REPO_ROOT, shellSourcePaths } from "./paths.ts";

function isCompanionAppImporter(importer: string | undefined): boolean {
  return importer?.replaceAll("\\", "/").includes("satellites/companion/app/") ?? false;
}

function createAtAlias(paths: ReturnType<typeof shellSourcePaths>): Alias {
  const shellPrefix = `${paths.shell}/`;
  return {
    find: /^@\/(.*)$/,
    replacement: `${paths.shell}/$1`,
    customResolver(source, importer) {
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

export function createShellUiAliases(paraglideDir: string, root?: string): AliasOptions {
  const paths = shellSourcePaths(root);
  const repoRoot = root ?? REPO_ROOT;
  const sapBundledWorkerVite = join(
    repoRoot,
    "packages",
    "sap-contract",
    "src",
    "shared-worker-bundled-url.vite.ts",
  );
  return [
    { find: "@paraglide/messages", replacement: join(paraglideDir, "messages.js") },
    { find: "@paraglide/runtime", replacement: join(paraglideDir, "runtime.js") },
    { find: /^@chat\/(.*)$/, replacement: `${paths.chat}/$1` },
    { find: /^@admin\/(.*)$/, replacement: `${paths.admin}/$1` },
    { find: /^@task\/(.*)$/, replacement: `${paths.task}/$1` },
    { find: /^@pair\/(.*)$/, replacement: `${paths.pair}/$1` },
    { find: /^@shared\/(.*)$/, replacement: `${paths.companionShared}/$1` },
    createAtAlias(paths),
    { find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` },
    { find: /shared-worker-bundled-url\.ts$/, replacement: sapBundledWorkerVite },
  ];
}
