import { z } from "zod";

/** Bootstrap：database.url（YAML） */
export const databaseConfigSchema = z.object({
  url: z.string().min(1),
});

export type DatabaseConfigInput = z.infer<typeof databaseConfigSchema>;

/** 空段 / 透传占位（如 push） */
export const sectionSchema = z.object({}).passthrough();

export { mcpServerSchema } from "./mcp.ts";
export { acpAgentSchema } from "./acp.ts";
export { fallbackProviderSchema } from "./fallback-providers.ts";
export { firecrawlSchema } from "./firecrawl.ts";
export { browserSchema } from "./browser.ts";
export { clarifySchema } from "./clarify.ts";
export { cjkConfigSchema, type CjkConfigInput } from "./cjk.ts";
export { ftsConfigSchema, ftsTrgmConfigSchema, type FtsConfigInput } from "./fts.ts";
export { eventbusConfigSchema, type EventbusConfigInput } from "./eventbus.ts";
export { compressionSchema } from "./compression.ts";
export { modelsConfigSchema } from "./models.ts";
export {
  gatewayConfigSchema,
  gatewayToolDisplaySchema,
  type GatewayConfigInput,
} from "./gateway.ts";
export { discordConfigSchema, type DiscordConfigInput } from "./discord.ts";
export { weixinConfigSchema, type WeixinConfigInput } from "./weixin.ts";
export { autoLlmConfigSchema, type AutoLlmConfigInput } from "./auto-llm.ts";
export { i18nConfigSchema, type I18nConfigInput } from "./i18n.ts";

export type { LlmConfig } from "./llm-config.ts";
export {
  llmConfigSchema,
  llmProfileSchema,
  llmProviderOpenAiSchema,
  llmRouteHopSchema,
  OPENAI_COMPATIBLE_BACKEND_ID,
} from "./llm-config.ts";
