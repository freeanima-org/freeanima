import { z } from "zod";

import { embeddingConfigSchema } from "./embedding.ts";
import { memoryConfigSchema } from "./memory-config.ts";
import { notificationsConfigSchema } from "./notifications.ts";
import { ttsConfigSchema } from "./tts.ts";
import { worldsConfigSchema } from "./worlds.ts";
import { llmConfigSchema } from "./llm-config.ts";
import {
  acpAgentSchema,
  autoLlmConfigSchema,
  browserSchema,
  cjkConfigSchema,
  clarifySchema,
  compressionSchema,
  discordConfigSchema,
  eventbusConfigSchema,
  fallbackProviderSchema,
  firecrawlSchema,
  ftsConfigSchema,
  gatewayConfigSchema,
  i18nConfigSchema,
  mcpServerSchema,
  modelsConfigSchema,
  sectionSchema,
  weixinConfigSchema,
} from "./config.ts";
import { BOOTSTRAP_CONFIG_KEYS } from "../bootstrap-config.ts";

/**
 * Habitat 运行时配置（PG habitat_runtime_config）。
 * 不含 bootstrap 段（database / http / redis）；禁止再引入与 bootstrap 合并的超集 schema。
 */
const runtimeConfigObjectSchema = z.object({
  i18n: i18nConfigSchema,
  llm: llmConfigSchema,
  firecrawl: firecrawlSchema.optional(),
  browser: browserSchema.optional(),
  clarify: clarifySchema.optional(),
  compression: compressionSchema.optional(),
  models: modelsConfigSchema.optional(),
  mcp_servers: z.record(z.string(), mcpServerSchema).optional(),
  acp_agents: z.record(z.string(), acpAgentSchema).optional(),
  fallback_providers: z.array(fallbackProviderSchema).optional(),
  platforms: z.record(z.string(), z.unknown()).optional(),
  memory: memoryConfigSchema.optional(),
  cjk: cjkConfigSchema,
  fts: ftsConfigSchema,
  embedding: embeddingConfigSchema,
  eventbus: eventbusConfigSchema,
  gateway: gatewayConfigSchema,
  auto_llm: autoLlmConfigSchema,
  discord: discordConfigSchema,
  weixin: weixinConfigSchema,
  push: sectionSchema.optional(),
  notifications: notificationsConfigSchema,
  worlds: worldsConfigSchema,
  tts: ttsConfigSchema,
});

export const runtimeConfigSchema = runtimeConfigObjectSchema.partial().passthrough();

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

/** 已知运行时段；未写入 PG 时 getSection 应返回 {} */
export const RUNTIME_CONFIG_SECTION_KEYS = Object.keys(runtimeConfigObjectSchema.shape) as Array<
  keyof typeof runtimeConfigObjectSchema.shape
>;

export type RuntimeConfigSectionKey = (typeof RUNTIME_CONFIG_SECTION_KEYS)[number];

export function isRuntimeConfigSectionKey(key: string): key is RuntimeConfigSectionKey {
  return (RUNTIME_CONFIG_SECTION_KEYS as readonly string[]).includes(key);
}

export function parseRuntimeConfig(document: Record<string, unknown>): RuntimeConfig {
  const cleaned: Record<string, unknown> = { ...document };
  for (const key of BOOTSTRAP_CONFIG_KEYS) {
    delete cleaned[key];
  }
  const parsed = runtimeConfigSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new Error(`Invalid runtime config: ${parsed.error.message}`);
  }
  return parsed.data;
}
