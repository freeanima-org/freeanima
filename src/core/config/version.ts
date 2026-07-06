import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getRepoRoot } from "./repo-root.ts";

/** Read monorepo root package.json version (User-Agent etc.) */
export function readAppVersion(repoRoot?: string): string {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as { version?: string };
  if (!pkg.version) {
    throw new Error(`root package.json missing version field: ${path}`);
  }
  return pkg.version;
}
