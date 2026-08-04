import type { RuntimeConfig } from "@freeanima/host/core/config";
import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  llmProviderSchema,
  tryGetLlmConfig,
} from "@freeanima/host/core/config";
import { providerConfigToSpec } from "@freeanima/host/core/llm/presets";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/host/core/provider";
import { OpenAiCompatibleBackend } from "./backend.ts";
import { OPENAI_COMPATIBLE_BACKEND_ID } from "./config.ts";
import { OpenAiResponsesBackend } from "./openai-responses/backend.ts";
import { AnthropicMessagesBackend } from "./anthropic-messages/backend.ts";

/** Register all Format adapters and materialize Connections from llm.providers. */
export function bindLlmStack(
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  backends.register(new OpenAiCompatibleBackend(LLM_FORMAT_OPENAI_COMPATIBLE));
  backends.register(new OpenAiResponsesBackend(LLM_FORMAT_OPENAI_RESPONSES));
  backends.register(new AnthropicMessagesBackend(LLM_FORMAT_ANTHROPIC_MESSAGES));

  const llm = tryGetLlmConfig(cfg);
  if (!llm) return;

  for (const [id, raw] of Object.entries(llm.providers)) {
    const providerCfg = llmProviderSchema.parse(raw);
    providers.registerSpec(providerConfigToSpec(id, providerCfg));
  }
}

/** @deprecated Use {@link bindLlmStack} */
export const bindOpenAiCompatibleLlm = bindLlmStack;

export { OPENAI_COMPATIBLE_BACKEND_ID };
