import { join } from "node:path";
import type { AliasOptions } from "vite";

import { shellSourcePaths } from "./paths.ts";

export function createShellUiAliases(paraglideDir: string, root?: string): AliasOptions {
  const paths = shellSourcePaths(root);
  return [
    { find: "@paraglide/messages", replacement: join(paraglideDir, "messages.js") },
    { find: "@paraglide/runtime", replacement: join(paraglideDir, "runtime.js") },
    { find: /^@chat\/(.*)$/, replacement: `${paths.chat}/$1` },
    { find: /^@admin\/(.*)$/, replacement: `${paths.admin}/$1` },
    { find: /^@task\/(.*)$/, replacement: `${paths.task}/$1` },
    { find: /^@pair\/(.*)$/, replacement: `${paths.pair}/$1` },
    { find: /^@shared\/(.*)$/, replacement: `${paths.companionShared}/$1` },
    { find: /^@\/(.*)$/, replacement: `${paths.shell}/$1` },
    { find: /^(.*)messages\/paraglide\/(.*)$/, replacement: `${paraglideDir}/$2` },
  ];
}
