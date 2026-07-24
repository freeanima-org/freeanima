import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isStandaloneExecutable } from "./cli-install.ts";
import { getRepoRoot } from "./repo-root.ts";
import { getStandaloneRuntimeMeta } from "./standalone-runtime-meta.ts";

/** Read app version：standalone 用编译期嵌入；源码读 root package.json */
export function readAppVersion(repoRoot?: string): string {
  if (isStandaloneExecutable()) {
    const embedded = getStandaloneRuntimeMeta()?.version?.trim();
    if (embedded) return embedded;
  }

  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
    if (!pkg.version) {
      throw new Error(`root package.json missing version field: ${path}`);
    }
    return pkg.version;
  } catch (err) {
    const embedded = getStandaloneRuntimeMeta()?.version?.trim();
    if (embedded) return embedded;
    throw err;
  }
}
