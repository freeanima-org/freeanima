import type { RuntimeConfig } from "@freeanima/habitat/core/config";
import {
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  connectionSchema,
  getConnections,
} from "@freeanima/habitat/core/config";
import {
  connectionHasTextCapability,
  providerConfigToSpec,
} from "@freeanima/habitat/core/llm/presets";
import type { BackendRegistry, ProviderRegistry } from "@freeanima/habitat/core/provider";
import { OpenAiCompatibleBackend } from "./backend.ts";
import { OpenAiResponsesBackend } from "./openai-responses/backend.ts";
import { AnthropicMessagesBackend } from "./anthropic-messages/backend.ts";

/** Register all Format adapters and materialize text-capable Connections. */
export function bindLlmStack(
  cfg: RuntimeConfig,
  backends: BackendRegistry,
  providers: ProviderRegistry,
): void {
  backends.register(new OpenAiCompatibleBackend(LLM_FORMAT_OPENAI_COMPATIBLE));
  backends.register(new OpenAiResponsesBackend(LLM_FORMAT_OPENAI_RESPONSES));
  backends.register(new AnthropicMessagesBackend(LLM_FORMAT_ANTHROPIC_MESSAGES));

  const connections = getConnections(cfg);

  for (const [id, raw] of Object.entries(connections)) {
    let providerCfg;
    try {
      providerCfg = connectionSchema.parse(raw);
    } catch {
      continue;
    }
    if (!providerCfg.api_key?.trim()) continue;
    if (!connectionHasTextCapability(providerCfg)) continue;
    try {
      providers.registerSpec(providerConfigToSpec(id, providerCfg));
    } catch {
      // skip connections that cannot materialize as chat providers
    }
  }
}
