/**
 * 解析 `tauri android init` 生成的 app 模块路径。
 * Cargo package `freeanima-portal` → `gen/android/freeanima_portal/`（勿写死 `portal`）。
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_ANDROID_GEN = "packages/frontend/portal/app/tauri/src-tauri/gen/android";

/** `…/gen/android/<app>/src/main`，找不到则 null */
export function resolveTauriAndroidMain(repoRoot: string): string | null {
  const androidGen = join(repoRoot, DEFAULT_ANDROID_GEN);
  if (!existsSync(androidGen)) return null;

  const preferred = ["freeanima_portal", "portal"];
  for (const name of preferred) {
    const main = join(androidGen, name, "src/main");
    if (existsSync(join(main, "AndroidManifest.xml"))) return main;
  }

  for (const name of readdirSync(androidGen, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .toSorted()) {
    const main = join(androidGen, name, "src/main");
    if (existsSync(join(main, "AndroidManifest.xml"))) return main;
  }
  return null;
}
