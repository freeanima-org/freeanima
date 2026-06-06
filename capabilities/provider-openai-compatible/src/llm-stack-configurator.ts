import type { NestConfig } from "@freeanima/service-config";
import { getLlmConfig } from "@freeanima/service-config";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/engine-provider-llm";
import {
  OpenAiCompatibleBackend,
  OPENAI_COMPATIBLE_BACKEND_ID,
  parseOpenAiCompatibleProviderSpec,
} from "./index.ts";

/** 向 engine-llm 注册 OpenAI 兼容 provider/backend */
export function wireOpenAiCompatibleLlm(
  cfg: NestConfig,
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
      throw new Error(`不支持的 llm.providers.${id}.backend: ${String(record.backend)}`);
    }
  }
}
