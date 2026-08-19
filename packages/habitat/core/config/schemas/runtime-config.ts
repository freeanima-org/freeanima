import { z } from "zod";

import { embeddingConfigSchema } from "./embedding.ts";
import {
  memoryClusteringConfigSchema,
  memoryConfigSchema,
  passiveRecallConfigSchema,
} from "./memory-config.ts";
import { notificationsConfigSchema } from "./notifications.ts";
import { ttsConfigSchema } from "./tts.ts";
import { worldsConfigSchema } from "./worlds.ts";
import { connectionsConfigSchema } from "./llm-config.ts";
import {
  audioGenerateConfigSchema,
  mainOnlyGenerateConfigSchema,
  textGenerateConfigSchema,
} from "./capability.ts";
import { mcpServerSchema } from "./mcp.ts";
import { fallbackProviderSchema } from "./fallback-providers.ts";
import { firecrawlSchema } from "./firecrawl.ts";
import { browserSchema } from "./browser.ts";
import { clarifySchema } from "./clarify.ts";
import { compressionSchema } from "./compression.ts";
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
import { identityConfigSchema } from "./identity.ts";
import { BOOTSTRAP_CONFIG_KEYS, registerSection } from "@freeanima/habitat/kernel/config-mechanism";

/**
 * Habitat 运行时配置（PG habitat_runtime_config：一行一段）。
 * 不含 bootstrap 段（database / http / redis）；禁止再引入与 bootstrap 合并的超集 schema。
 * 类型 SSOT：下方静态 shape；运行时亦 registerSection 挂到 kernel 注册表。
 */
const runtimeConfigObjectSchema = z.object({
  i18n: i18nConfigSchema,
  connections: connectionsConfigSchema.optional(),
  text_generate: textGenerateConfigSchema.optional(),
  image_generate: mainOnlyGenerateConfigSchema.optional(),
  audio_generate: audioGenerateConfigSchema.optional(),
  video_generate: mainOnlyGenerateConfigSchema.optional(),
  firecrawl: firecrawlSchema.optional(),
  browser: browserSchema.optional(),
  clarify: clarifySchema.optional(),
  compression: compressionSchema.optional(),
  prompt: promptSchema.optional(),
  mcp_servers: z.record(z.string(), mcpServerSchema).optional(),
  /**
   * Runtime overrides for ToolSet discovery visibility (name → visibility).
   * Takes precedence over register-time / MCP server toolset_visibility.
   */
  toolset_visibility: z.record(z.string(), z.enum(["hidden", "searchable", "catalog"])).optional(),
  fallback_providers: z.array(fallbackProviderSchema).optional(),
  platforms: z.record(z.string(), z.unknown()).optional(),
  /** @deprecated 新写入用顶层 passive_recall / semantic_clustering；保留供旧配置与 resident 等 */
  memory: memoryConfigSchema.optional(),
  /** 被动语义召回（设置 UI 独立段） */
  passive_recall: passiveRecallConfigSchema.optional(),
  /** 语义记忆聚类 HDBSCAN（设置 UI 独立段） */
  semantic_clustering: memoryClusteringConfigSchema.optional(),
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
  /** Habitat 实例身份与主体密钥（私钥仅服务端） */
  identity: identityConfigSchema.optional(),
});

/** 将各产品段 Zod 挂入 kernel section 注册表（幂等合并） */
export function registerRuntimeConfigSchemas(): void {
  for (const [key, schema] of Object.entries(runtimeConfigObjectSchema.shape)) {
    registerSection({ key, schema });
  }
}

registerRuntimeConfigSchemas();

export const runtimeConfigSchema = runtimeConfigObjectSchema.partial().passthrough();

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

/** 已知运行时段（与静态 shape / registerSection 同源） */
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
