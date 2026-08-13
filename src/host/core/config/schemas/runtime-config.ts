import { z } from "zod";

import { embeddingConfigSchema } from "./embedding.ts";
import { memoryConfigSchema } from "./memory-config.ts";
import { notificationsConfigSchema } from "./notifications.ts";
import { ttsConfigSchema } from "./tts.ts";
import { worldsConfigSchema } from "./worlds.ts";
import { llmConfigSchema } from "./llm-config.ts";
import { mcpServerSchema } from "./mcp.ts";
import { fallbackProviderSchema } from "./fallback-providers.ts";
import { firecrawlSchema } from "./firecrawl.ts";
import { browserSchema } from "./browser.ts";
import { clarifySchema } from "./clarify.ts";
import { compressionSchema } from "./compression.ts";
import { modelsConfigSchema } from "./models.ts";
import { cjkConfigSchema } from "./cjk.ts";
import { ftsConfigSchema } from "./fts.ts";
import { gatewayConfigSchema } from "./gateway.ts";
import { autoLlmConfigSchema } from "./auto-llm.ts";
import { discordConfigSchema } from "./discord.ts";
import { weixinConfigSchema } from "./weixin.ts";
import { i18nConfigSchema } from "./i18n.ts";
import { sectionSchema } from "./config.ts";
import { objectStorageConfigSchema } from "./object-storage.ts";
import { companionConfigSchema } from "./companion.ts";
import { promptSchema } from "./prompt.ts";
import { BOOTSTRAP_CONFIG_KEYS } from "../bootstrap-config.ts";

/**
 * Habitat 运行时配置（PG habitat_runtime_config：一行一段）。
 * 不含 bootstrap 段（database / http / redis）；禁止再引入与 bootstrap 合并的超集 schema。
 */
const runtimeConfigObjectSchema = z.object({
  i18n: i18nConfigSchema,
  llm: llmConfigSchema,
  firecrawl: firecrawlSchema.optional(),
  browser: browserSchema.optional(),
  clarify: clarifySchema.optional(),
  compression: compressionSchema.optional(),
  prompt: promptSchema.optional(),
  models: modelsConfigSchema.optional(),
  mcp_servers: z.record(z.string(), mcpServerSchema).optional(),
  /**
   * Runtime overrides for ToolSet discovery visibility (name → visibility).
   * Takes precedence over register-time / MCP server toolset_visibility.
   */
  toolset_visibility: z.record(z.string(), z.enum(["hidden", "searchable", "catalog"])).optional(),
  fallback_providers: z.array(fallbackProviderSchema).optional(),
  platforms: z.record(z.string(), z.unknown()).optional(),
  memory: memoryConfigSchema.optional(),
  cjk: cjkConfigSchema,
  fts: ftsConfigSchema,
  embedding: embeddingConfigSchema,
  gateway: gatewayConfigSchema,
  auto_llm: autoLlmConfigSchema,
  discord: discordConfigSchema,
  weixin: weixinConfigSchema,
  push: sectionSchema.optional(),
  notifications: notificationsConfigSchema,
  worlds: worldsConfigSchema,
  tts: ttsConfigSchema,
  object_storage: objectStorageConfigSchema.optional(),
  /** 桌面伴侣模块配置（行为 / 模型与动作注册表）；字节在 object_file */
  companion: companionConfigSchema.optional(),
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
