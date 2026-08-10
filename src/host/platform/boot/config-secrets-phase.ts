import type { RuntimeConfigStore } from "@freeanima/host/platform/config";
import { resolveLlmProviderApiKeys } from "@freeanima/host/platform/config";
import { applyHostI18nConfig } from "@freeanima/host/core/i18n";
import { bindEmbeddingRuntime } from "../service/embedding-bind.ts";
import { bindSearchRuntime } from "@freeanima/host/core/db/pg/search";
import { bindTokenizerRuntime } from "../service/tokenizer-bind.ts";

import { startupLog } from "./status.ts";

/** Phase 2.6: 解析 vault/env 引用（需 PG + ResolvedWorldContext 已就绪） */
export async function bootConfigSecretsPhase(config: RuntimeConfigStore): Promise<void> {
  startupLog("Resolving config secrets (vault/env)…");
  config.update(await resolveLlmProviderApiKeys(config.data));
  const i18n = config.data.i18n;
  applyHostI18nConfig({
    locale: i18n?.locale,
    timezone: i18n?.timezone,
  });
  bindEmbeddingRuntime(config);
  bindSearchRuntime(config);
  await bindTokenizerRuntime(config);
}
