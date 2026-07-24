import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { getRepoRoot } from "./repo-root.ts";
export { readAppVersion } from "@freeanima/host/core/config";

/** Write monorepo root package.json version */
export function writeRootVersion(version: string, repoRoot?: string): void {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
