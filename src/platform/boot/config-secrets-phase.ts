import type { RuntimeConfigStore } from "@freeanima/platform/config";
import { resolveLlmProviderApiKeys } from "@freeanima/platform/config";
import { bindEmbeddingRuntime } from "../runtime/embedding-bind.ts";
import { bindTokenizerRuntime } from "../runtime/tokenizer-bind.ts";

import { startupLog } from "./status.ts";

/** Phase 2.6: 解析 vault/env 引用（需 PG + ResolvedWorldContext 已就绪） */
export async function bootConfigSecretsPhase(config: RuntimeConfigStore): Promise<void> {
  startupLog("Resolving config secrets (vault/env)…");
  config.update(await resolveLlmProviderApiKeys(config.data));
  bindEmbeddingRuntime(config);
  await bindTokenizerRuntime(config);
}
