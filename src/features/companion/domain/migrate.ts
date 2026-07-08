import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
import { ensureCompanionDataDir, companionModelsDir, companionMotionsDir } from "./paths.ts";
import type { CompanionConfig } from "./types.ts";
import { mergeBehavior } from "./behavior.ts";

export type MigrateFromLocalResult = {
  imported_models: number;
  imported_motions: number;
  config: CompanionConfig;
};

function defaultSourceDir(): string {
  const home = process.env.FREEANIMA_HOME?.trim() || join(homedir(), ".anima");
  return join(home, "companion");
}

function copyTreeFiles(srcDir: string, destDir: string, ext: string): number {
  if (!existsSync(srcDir)) return 0;
  mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of readdirSync(srcDir)) {
    if (!file.toLowerCase().endsWith(ext)) continue;
    const src = join(srcDir, file);
    if (!statSync(src).isFile()) continue;
    const dest = join(destDir, file);
    if (!existsSync(dest)) {
      copyFileSync(src, dest);
      count += 1;
    }
  }
  return count;
}

export async function migrateFromLocalDir(sourceDir?: string): Promise<MigrateFromLocalResult> {
  const source = sourceDir?.trim() || defaultSourceDir();
  ensureCompanionDataDir();

  const imported_models = copyTreeFiles(join(source, "models"), companionModelsDir(), ".vrm");
  const imported_motions = copyTreeFiles(join(source, "motions"), companionMotionsDir(), ".vrma");

  const legacyConfigPath = join(source, "config.json");
  if (existsSync(legacyConfigPath)) {
    try {
      const raw = JSON.parse(readFileSync(legacyConfigPath, "utf-8")) as Partial<CompanionConfig>;
      const current = await loadCompanionConfig();
      await saveCompanionConfig({
        active_model_id: raw.active_model_id ?? current.active_model_id,
        models: raw.models?.length ? raw.models : current.models,
        motion_library: raw.motion_library?.length ? raw.motion_library : current.motion_library,
        motion_slots: raw.motion_slots ?? current.motion_slots,
        behavior: mergeBehavior({ ...current.behavior, ...raw.behavior }),
      });
    } catch {
      /* 忽略损坏的旧配置 */
    }
  }

  const config = await loadCompanionConfig();
  return { imported_models, imported_motions, config };
}
