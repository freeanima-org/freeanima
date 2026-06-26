import type { AliasOptions } from "vite";

import { shellSourcePaths } from "./paths.ts";

export function createShellUiAliases(paraglideDir: string, root?: string): AliasOptions {
  const paths = shellSourcePaths(root);
  return [
    { find: /^@chat\/(.*)$/, replacement: `${paths.chat}/$1` },
    { find: /^@admin\/(.*)$/, replacement: `${paths.admin}/$1` },
    { find: /^@task\/(.*)$/, replacement: `${paths.task}/$1` },
    { find: /^@pair\/(.*)$/, replacement: `${paths.pair}/$1` },
    { find: /^@shared\/(.*)$/, replacement: `${paths.companionShared}/$1` },
    { find: /^@\/(.*)$/, replacement: `${paths.shell}/$1` },
    { find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` },
  ];
}
