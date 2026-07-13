import {
  getActiveRuntimeConfig,
  getConfiguredDatabaseUrlFromBootstrap,
  isPatchableRuntimeConfig,
} from "@freeanima/platform/config";
import { isBootstrapConfigKey } from "@freeanima/core/config";
import {
  getHubRuntimeConfigDocument,
  patchHubRuntimeConfigSection,
  replaceHubRuntimeConfigSection,
} from "@freeanima/core/db/pg";
import { getDb, initDatabase } from "@freeanima/core/db/pg";

import { loadBootstrapConfig } from "../boot/bootstrap.ts";

async function ensureDbFromBootstrap(): Promise<void> {
  try {
    getDb();
    return;
  } catch {
    /* not initialized */
  }
  const bootstrap = loadBootstrapConfig();
  const dbUrl = await getConfiguredDatabaseUrlFromBootstrap(bootstrap);
  if (!dbUrl) {
    throw new Error("database.url 未配置；无法访问运行时配置");
  }
  initDatabase({ getDatabaseUrl: () => dbUrl });
}

/** Hub 进程内或 CLI 独立写入运行时段 */
export async function patchRuntimeConfigSection(
  section: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (isBootstrapConfigKey(section)) {
    throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非 Hub 服务配置`);
  }

  try {
    const active = getActiveRuntimeConfig();
    if (isPatchableRuntimeConfig(active)) {
      await active.patchSection(section, patch);
      return;
    }
  } catch {
    /* Hub 未启动：走 PG 直连 */
  }

  await ensureDbFromBootstrap();
  await patchHubRuntimeConfigSection(section, patch);
}

export async function replaceRuntimeConfigSection(
  section: string,
  value: Record<string, unknown>,
): Promise<void> {
  if (isBootstrapConfigKey(section)) {
    throw new Error(`bootstrap 段 ${section} 为平台冷启动配置，非 Hub 服务配置`);
  }

  try {
    const active = getActiveRuntimeConfig();
    if (isPatchableRuntimeConfig(active)) {
      await active.replaceSection(section, value);
      return;
    }
  } catch {
    /* Hub 未启动：走 PG 直连 */
  }

  await ensureDbFromBootstrap();
  await replaceHubRuntimeConfigSection(section, value);
}

export async function loadRuntimeConfigSection<T = unknown>(
  section: string,
): Promise<T | undefined> {
  try {
    const active = getActiveRuntimeConfig();
    const value = (active.data as Record<string, unknown>)[section];
    return value as T | undefined;
  } catch {
    await ensureDbFromBootstrap();
    const document = await getHubRuntimeConfigDocument();
    return document[section] as T | undefined;
  }
}
