import { existsSync } from "node:fs";
import { join } from "node:path";

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

  throw new Error(
    "无法推断 companion 包根目录：请设置 COMPANION_PACKAGE_ROOT（companion dev.ts 会自动注入）",
  );
}
