import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  llmProviderSchema,
  tryGetLlmConfig,
} from "@freeanima/habitat/core/config";
import { providerConfigToSpec } from "@freeanima/habitat/core/llm/presets";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/habitat/core/provider";
import { OpenAiCompatibleBackend } from "./backend.ts";
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
    // 纯语音等无密钥连接不进 chat ProviderRegistry
    if (!providerCfg.api_key?.trim()) continue;
    const textProto = providerCfg.format ?? providerCfg.text_protocol;
    if (textProto == null && providerCfg.preset === "custom") continue;
    try {
      providers.registerSpec(providerConfigToSpec(id, providerCfg));
    } catch {
      // skip connections that cannot materialize as chat providers
    }
  }
}
