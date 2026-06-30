import { z } from "zod";
import { llmConfigSchema } from "./llm-config.ts";
import { embeddingConfigSchema } from "./embedding.ts";
import { tunnelConfigSchema } from "./tunnel.ts";
import { remoteAuthConfigSchema } from "./remote-auth.ts";
import { httpConfigSchema } from "./http.ts";
import { webConfigSchema } from "./web.ts";
import { notificationsConfigSchema } from "./notifications.ts";
import { worldsConfigSchema } from "./worlds.ts";

export const mcpServerSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    url: z.string().optional(),
    transport: z.enum(["stdio", "sse"]).optional(),
    api_key_env: z.string().optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    connect_timeout_ms: z.number().int().positive().optional(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

export const satelliteEntrySchema = z
  .object({
    enabled: z.boolean().optional(),
    command: z.string().min(1).optional(),
    args: z.array(z.string()).default([]),
    env: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export type SatelliteEntryConfig = z.infer<typeof satelliteEntrySchema>;

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

const memorySchema = z.object({}).passthrough();

const firecrawlSchema = z.object({
  api_url: z.string().optional(),
});

const camofoxBrowserSchema = z.object({
  /** Camofox REST base URL (browser.camofox.base_url) */
  base_url: z.string().optional(),
  /** Single HTTP request timeout (ms), default 30000 */
  timeout_ms: z.number().int().positive().optional(),
  /** Enable profile-level persistent browser profile (reuse userId across tasks) */
  managed_persistence: z.boolean().optional(),
  /** Try to adopt existing Camofox tab after process restart */
  adopt_existing_tab: z.boolean().optional(),
  /** Externally specified Camofox userId (shared browser profile) */
  user_id: z.string().optional(),
  /** Externally specified conversationKey */
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

const gatewayConfigSchema = z
  .object({
    tool_display: z.string().optional(),
  })
  .optional();

const autoLlmConfigSchema = z
  .object({
    retention_days: z.number().int().positive().optional(),
    per_run_kind_keep: z.number().int().nonnegative().optional(),
  })
  .optional();

export type AutoLlmConfigInput = z.infer<typeof autoLlmConfigSchema>;

export const animaConfigSchema = z
  .object({
    llm: llmConfigSchema,
    firecrawl: firecrawlSchema.optional(),
    browser: browserSchema.optional(),
    clarify: clarifySchema.optional(),
    compression: compressionSchema.optional(),
    models: modelsConfigSchema.optional(),
    mcp_servers: z.record(z.string(), mcpServerSchema).optional(),
    satellites: z.record(z.string(), satelliteEntrySchema).optional(),
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
    discord: sectionSchema.optional(),
    weixin: sectionSchema.optional(),
    push: sectionSchema.optional(),
    tunnel: tunnelConfigSchema,
    http: httpConfigSchema,
    web: webConfigSchema,
    remote_auth: remoteAuthConfigSchema.optional(),
    notifications: notificationsConfigSchema,
    worlds: worldsConfigSchema,
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
