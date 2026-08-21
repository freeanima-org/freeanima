import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { asRecord } from "@freeanima/shared/util";

import { getRepoRoot } from "./repo-root.ts";
export { readAppVersion } from "@freeanima/habitat/core/config/version";

/** Write monorepo root package.json version */
export function writeRootVersion(version: string, repoRoot?: string): void {
  const root = repoRoot ?? getRepoRoot();
  const path = join(root, "package.json");
  const pkg = asRecord(JSON.parse(readFileSync(path, "utf8")));
  if (!pkg) throw new Error(`invalid package.json: ${path}`);
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
