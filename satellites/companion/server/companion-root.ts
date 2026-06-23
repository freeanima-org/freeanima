import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * satellites/companion 包根目录。
 * desktop-shell 可通过 COMPANION_PACKAGE_ROOT 注入；否则按源码 / bundle 位置推断。
 */
export function companionPackageRoot(): string {
  const fromEnv = process.env.COMPANION_PACKAGE_ROOT?.trim();
  if (fromEnv) return fromEnv;

  if (typeof __dirname !== "undefined") {
    const shellRoot = join(__dirname, "..");
    const vendorCompanion = join(shellRoot, "vendor", "companion");
    if (existsSync(vendorCompanion)) return vendorCompanion;
    const devCompanion = join(shellRoot, "..", "companion");
    if (existsSync(devCompanion)) return devCompanion;
    return shellRoot;
  }

  return join(dirname(fileURLToPath(import.meta.url)), "..");
}
