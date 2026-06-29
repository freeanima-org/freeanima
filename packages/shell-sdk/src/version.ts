import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION_CANDIDATES = [
  "../../../package.json",
  "../../../../package.json",
  "../../package.json",
  "../package.json",
  "../../../../../package.json",
];

export function readMonorepoVersion(moduleUrl?: string): string {
  const fromEnv =
    process.env.DESKTOP_SHELL_VERSION?.trim() ?? process.env.COMPANION_VERSION?.trim();
  if (fromEnv) return fromEnv.replace(/^v/i, "");

  let here: string | undefined;
  if (moduleUrl) {
    try {
      here = dirname(fileURLToPath(moduleUrl));
    } catch {
      // bundled CJS 中 import.meta.url 可能无效
    }
  }
  if (!here && typeof __dirname !== "undefined") {
    here = __dirname;
  }
  if (!here) return "0.0.0";

  for (const rel of VERSION_CANDIDATES) {
    const path = join(here, rel);
    if (!existsSync(path)) continue;
    try {
      const pkg = JSON.parse(readFileSync(path, "utf-8")) as { version?: string };
      const version = pkg.version?.trim();
      if (version) return version;
    } catch {
      // try next candidate
    }
  }
  return "0.0.0";
}
