import {
  getActiveConfig,
  getConfiguredDatabaseUrl,
  isPatchableConfig,
  loadConfigYamlRecord,
} from "@freeanima/platform/config";
import {
  bootstrapConfigSchema,
  isBootstrapConfigKey,
  pickBootstrapRecord,
  type AnimaConfig,
} from "@freeanima/core/config";
import { getHubRuntimeConfigDocument, patchHubRuntimeConfigSection } from "@freeanima/core/db/pg";
import { getDb, initDatabase } from "@freeanima/core/db/pg";

async function ensureDbFromBootstrap(): Promise<void> {
  try {
    getDb();
    return;
  } catch {
    /* not initialized */
  }
  const bootstrap = bootstrapConfigSchema.parse(pickBootstrapRecord(loadConfigYamlRecord()));
  const dbUrl = await getConfiguredDatabaseUrl(bootstrap as AnimaConfig);
  if (!dbUrl) {
    throw new Error("database.url 未配置；无法写入运行时配置");
  }
  initDatabase({ getDatabaseUrl: () => dbUrl });
}

/** Hub 进程内或 CLI 独立写入运行时段 */
export async function patchRuntimeConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (isBootstrapConfigKey(section)) {
    throw new Error(`bootstrap 段 ${section} 请编辑 config.yaml`);
  }

  try {
    const active = getActiveConfig();
    if (isPatchableConfig(active)) {
      await active.patchSection(section, patch);
      return;
    }
  } catch {
    /* Hub 未启动：走 PG 直连 */
  }

  await ensureDbFromBootstrap();
  await patchHubRuntimeConfigSection(section, patch);
}

export async function loadRuntimeConfigSection<T = unknown>(
  section: string,
): Promise<T | undefined> {
  try {
    const active = getActiveConfig();
    const value = (active.data as Record<string, unknown>)[section];
    return value as T | undefined;
  } catch {
    await ensureDbFromBootstrap();
    const document = await getHubRuntimeConfigDocument();
    return document[section] as T | undefined;
  }
}
