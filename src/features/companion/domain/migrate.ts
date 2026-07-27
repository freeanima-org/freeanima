import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { companionBehaviorSchema } from "@freeanima/host/core/config/schemas/companion.ts";
import { loadCompanionConfig, saveCompanionConfig } from "./config.ts";
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

/**
 * 本地遗留目录：仅合并 behavior。
 * 模型/动作须经 Settings 重新上传（object_storage），不再从磁盘扫入配置。
 */
export async function migrateFromLocalDir(sourceDir?: string): Promise<MigrateFromLocalResult> {
  const source = sourceDir?.trim() || defaultSourceDir();
  const legacyConfigPath = join(source, "config.json");
  if (existsSync(legacyConfigPath)) {
    try {
      const raw = JSON.parse(readFileSync(legacyConfigPath, "utf-8")) as {
        behavior?: unknown;
      };
      const behavior = companionBehaviorSchema.safeParse(raw.behavior);
      if (behavior.success) {
        const current = await loadCompanionConfig();
        await saveCompanionConfig({
          behavior: mergeBehavior({ ...current.behavior, ...behavior.data }),
        });
      }
    } catch {
      /* 忽略损坏的旧配置 */
    }
  }

  const config = await loadCompanionConfig();
  return { imported_models: 0, imported_motions: 0, config };
}
