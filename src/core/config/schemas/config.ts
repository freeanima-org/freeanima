import { z } from "zod";
import { llmConfigSchema } from "./llm-config.ts";
import { embeddingConfigSchema } from "./embedding.ts";
import { httpConfigSchema } from "./http.ts";
import { webConfigSchema } from "./web.ts";
import { notificationsConfigSchema } from "./notifications.ts";
import { worldsConfigSchema } from "./worlds.ts";
import { memoryConfigSchema } from "./memory-config.ts";
import { ttsConfigSchema } from "./tts.ts";

export const mcpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    /** stdio | sse（旧 HTTP+SSE）| http（Streamable HTTP，连 Habitat /mcp 用这个） */
    transport: z.enum(["stdio", "sse", "http"]).optional(),
    /** @deprecated Prefer `headers.Authorization`; kept for runtime compat */
    api_key_env: z.string().optional(),
    headers: z.record(z.string(), z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    connect_timeout_ms: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

export const acpAgentSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    description: z.string().optional(),
    adapter: z.string().optional(),
    plan_mode: z.union([z.string(), z.boolean()]).optional(),
    agent_mode: z.string().optional(),
    /** Cursor ACP model; `auto` means Auto (default[]); default cursor adapter is also auto */
    model: z.string().optional(),
    url: z.string().optional(),
    transport: z.enum(["stdio", "sse"]).optional(),
    name: z.string().optional(),
    /** Connection timeout (ms), default 15000; for initialize / authenticate / session/new etc. */
    connect_timeout_ms: z.number().int().positive().optional(),
    /** Prompt timeout (ms), default 120000; for session/prompt */
    prompt_timeout_ms: z.number().int().positive().optional(),
    /** Auto-connect on freeanima startup, default true */
    enabled: z.boolean().optional(),
    /** Health check interval (ms), default 60000; 0 disables */
    health_check_interval_ms: z.number().int().nonnegative().optional(),
    /** Session TTL (ms), default 0 (no expiry) */
    session_ttl_ms: z.number().int().nonnegative().optional(),
    /** Retry once after prompt timeout, default true */
    prompt_retry_once: z.boolean().optional(),
    /** Auto-restart after child crash, default true */
    auto_restart: z.boolean().optional(),
    /** Max concurrent async tasks per agent (separate subprocess each), default 3 */
    max_concurrent_tasks: z.number().int().positive().optional(),
  })
  .passthrough();

const fallbackProviderSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  base_url: z.string().optional(),
});

const memorySchema = memoryConfigSchema;

const firecrawlSchema = z.object({
  api_url: z.string().optional(),
});

const camofoxBrowserSchema = z.object({
  /** Camofox REST base URL (browser.camofox.base_url) */
  base_url: z.string().optional(),
  /** Single HTTP request timeout (ms); default 30000 when unset */
  timeout_ms: z.number().int().positive().optional(),
  /**
   * Persist a local Camofox profile (stable userId) across conversations.
   * Default true when unset; set false for ephemeral random userId.
   * See docs/tools/browser-camofox.md.
   */
  managed_persistence: z.boolean().optional(),
  /** Adopt existing Camofox tab after process restart; default true when unset */
  adopt_existing_tab: z.boolean().optional(),
  /** Explicit Camofox userId (shared browser profile); overrides managed_persistence when set */
  user_id: z.string().optional(),
  /** Explicit Camofox sessionKey; only applied when user_id is set */
  session_key: z.string().optional(),
});

const browserSchema = z.object({
  camofox: camofoxBrowserSchema.optional(),
});

const clarifySchema = z.object({
  timeout_sec: z.number().int().min(60).optional(),
  max_items: z.number().int().min(1).max(10).optional(),
});

export const databaseConfigSchema = z.object({
  url: z.string().min(1),
});

export const cjkConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    dict_path: z.string().optional(),
  })
  .optional();

export type CjkConfigInput = z.infer<typeof cjkConfigSchema>;

export const ftsTrgmConfigSchema = z
  .object({
    min_similarity: z.number().min(0).max(1).optional(),
    fallback_when_hits_lt: z.number().int().nonnegative().optional(),
  })
  .optional();

export const ftsConfigSchema = z
  .object({
    trgm: ftsTrgmConfigSchema,
  })
  .optional();

export type FtsConfigInput = z.infer<typeof ftsConfigSchema>;

export type DatabaseConfigInput = z.infer<typeof databaseConfigSchema>;

const redisConfigSchema = z
  .object({
    url: z.string().optional(),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    password: z.string().optional(),
    db: z.number().int().nonnegative().optional(),
  })
  .optional();

export const eventbusConfigSchema = z
  .object({
    backend: z.enum(["redis"]).optional(),
    key_prefix: z.string().min(1).optional(),
  })
  .optional();

export type EventbusConfigInput = z.infer<typeof eventbusConfigSchema>;

const modelEntrySchema = z.object({
  context_window: z.number().int().positive().optional(),
});

const compressionSchema = z.object({
  enabled: z.boolean().optional(),
  max_rounds: z.number().int().positive().optional(),
  default_context_window: z.number().int().positive().optional(),
  reserved_tokens: z.number().int().positive().optional(),
  trigger_high: z.number().min(0).max(1).optional(),
  trigger_low: z.number().min(0).max(1).optional(),
  emergency_ratio: z.number().min(0).max(1).optional(),
  raw_min_messages: z.number().int().positive().optional(),
  slim_min_messages: z.number().int().positive().optional(),
  summary_max_tokens: z.number().int().positive().optional(),
});

export const modelsConfigSchema = z.record(z.string(), modelEntrySchema);

const sectionSchema = z.object({}).passthrough();

/** 与 gateway tool-display 模式对齐（core 不依赖 platform） */
export const gatewayToolDisplaySchema = z.enum([
  "hidden",
  "count",
  "name",
  "name_args_truncated",
  "name_args_full",
  "name_args_result_full",
]);

export const gatewayConfigSchema = z
  .object({
    tool_display: gatewayToolDisplaySchema.optional(),
  })
  .passthrough()
  .optional();

/** Discord 网关段；passthrough 保留未接线旧字段 */
export const discordConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().optional(),
    require_mention: z.boolean().optional(),
    free_response_channels: z.string().optional(),
    allowed_channels: z.string().optional(),
    auto_thread: z.boolean().optional(),
    thread_require_mention: z.boolean().optional(),
    slash_commands: z.boolean().optional(),
    slash_commands_guild_id: z.string().optional(),
    session_handoff_on_new: z.boolean().optional(),
    home_channel: z.string().optional(),
    home_thread_id: z.string().optional(),
  })
  .passthrough()
  .optional();

export const weixinConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token: z.string().optional(),
    base_url: z.string().optional(),
    user_id: z.string().optional(),
    account_id: z.string().optional(),
    session_handoff_on_new: z.boolean().optional(),
  })
  .passthrough()
  .optional();

const autoLlmConfigSchema = z
  .object({
    retention_days: z.number().int().positive().optional(),
    per_run_kind_keep: z.number().int().nonnegative().optional(),
  })
  .optional();

export type AutoLlmConfigInput = z.infer<typeof autoLlmConfigSchema>;
export type DiscordConfigInput = z.infer<typeof discordConfigSchema>;
export type WeixinConfigInput = z.infer<typeof weixinConfigSchema>;
export type GatewayConfigInput = z.infer<typeof gatewayConfigSchema>;

export const animaConfigSchema = z
  .object({
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
    memory: memorySchema.optional(),
    cjk: cjkConfigSchema,
    fts: ftsConfigSchema,
    embedding: embeddingConfigSchema,
    database: databaseConfigSchema.optional(),
    eventbus: eventbusConfigSchema,
    redis: redisConfigSchema,
    gateway: gatewayConfigSchema,
    auto_llm: autoLlmConfigSchema,
    discord: discordConfigSchema,
    weixin: weixinConfigSchema,
    push: sectionSchema.optional(),
    http: httpConfigSchema,
    web: webConfigSchema,
    notifications: notificationsConfigSchema,
    worlds: worldsConfigSchema,
    tts: ttsConfigSchema,
  })
  .passthrough();

export type AnimaConfig = z.infer<typeof animaConfigSchema>;
export type { LlmConfig } from "./llm-config.ts";
export {
  llmConfigSchema,
  llmProfileSchema,
  llmProviderOpenAiSchema,
  llmRouteHopSchema,
  OPENAI_COMPATIBLE_BACKEND_ID,
} from "./llm-config.ts";
