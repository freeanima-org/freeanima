import type { AnimaConfig } from "@freeanima/core/config";
import { getLlmConfig } from "@freeanima/core/config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/core/provider";
import {
  OpenAiCompatibleBackend,
  OPENAI_COMPATIBLE_BACKEND_ID,
  parseOpenAiCompatibleProviderSpec,
} from "./index.ts";

/** Register OpenAI compatible provider/backend with engine-llm */
export function wireOpenAiCompatibleLlm(
  cfg: AnimaConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  backends.register(new OpenAiCompatibleBackend(OPENAI_COMPATIBLE_BACKEND_ID));

  const llm = getLlmConfig(cfg);
  for (const [id, raw] of Object.entries(llm.providers)) {
    const record = raw as Record<string, unknown>;
    if (record.backend === OPENAI_COMPATIBLE_BACKEND_ID) {
      providers.registerSpec(parseOpenAiCompatibleProviderSpec(id, record));
    } else {
      throw new Error(`Unsupported llm.providers.${id}.backend: ${String(record.backend)}`);
    }
  }
}
