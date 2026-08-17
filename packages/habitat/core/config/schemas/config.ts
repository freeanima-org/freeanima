import { z } from "zod";

/** Bootstrap：database.url（YAML） */
export const databaseConfigSchema = z.object({
  url: z.string().min(1),
});

export type DatabaseConfigInput = z.infer<typeof databaseConfigSchema>;

/** 空段 / 透传占位（如 push） */
export const sectionSchema = z.object({}).passthrough();

export { mcpServerSchema } from "./mcp.ts";
export { fallbackProviderSchema } from "./fallback-providers.ts";
export { firecrawlSchema } from "./firecrawl.ts";
export { browserSchema } from "./browser.ts";
export { clarifySchema } from "./clarify.ts";
export { cjkConfigSchema, type CjkConfigInput } from "./cjk.ts";
export { ftsConfigSchema, ftsTrgmConfigSchema, type FtsConfigInput } from "./fts.ts";
export { compressionSchema } from "./compression.ts";
export { promptSchema, DEFAULT_SYSTEM_PROMPT_BUDGET_CHARS } from "./prompt.ts";
export type { PromptConfigInput } from "./prompt.ts";
export {
  gatewayConfigSchema,
  gatewayToolDisplaySchema,
  type GatewayConfigInput,
} from "./gateway.ts";
export { discordConfigSchema, type DiscordConfigInput } from "./discord.ts";
export { weixinConfigSchema, type WeixinConfigInput } from "./weixin.ts";
export { autoLlmConfigSchema, type AutoLlmConfigInput } from "./auto-llm.ts";
export { i18nConfigSchema, type I18nConfigInput } from "./i18n.ts";

export type { LlmConfig, LlmProviderConfig, LlmSceneBinding } from "./llm-config.ts";
export {
  llmConfigSchema,
  llmProfileSchema,
  llmProviderSchema,
  llmProviderLooseSchema,
  llmRouteHopSchema,
  llmSceneBindingSchema,
  normalizeLlmProviderRaw,
  getProviderTextProtocol,
  LLM_FORMAT_IDS,
  LLM_FORMAT_OPENAI_COMPATIBLE,
  LLM_FORMAT_OPENAI_RESPONSES,
  LLM_FORMAT_ANTHROPIC_MESSAGES,
  LLM_PRESET_IDS,
  LLM_PRESET_CUSTOM,
  LLM_PRESET_DEEPSEEK,
  LLM_PRESET_OPENROUTER,
  LLM_PRESET_OPENCODE_GO,
  IMAGE_PROTOCOL_OPENAI,
  IMAGE_PROTOCOL_ALIBABA_MULTIMODAL,
  IMAGE_PROTOCOL_IDS,
  EMBEDDINGS_PROTOCOL_OPENAI,
  EMBEDDINGS_PROTOCOL_IDS,
  VOICE_PROTOCOL_OPENAI_AUDIO,
  VOICE_PROTOCOL_EDGE_TTS,
  VOICE_PROTOCOL_IDS,
  DEFAULT_EDGE_TTS_BASE_URL,
  LLM_SCENE_PURPOSE_IDS,
} from "./llm-config.ts";
export type {
  LlmFormatId,
  LlmPresetId,
  TextProtocolId,
  ImageProtocolId,
  EmbeddingsProtocolId,
  VoiceProtocolId,
  LlmScenePurposeId,
} from "./llm-config.ts";
