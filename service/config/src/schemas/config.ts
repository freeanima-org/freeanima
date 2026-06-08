import { z } from "zod";
import { llmConfigSchema } from "./llm-config.ts";

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

export const acpAgentSchema = z
  .object({
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    cwd: z.string().optional(),
    description: z.string().optional(),
    adapter: z.string().optional(),
    plan_mode: z.union([z.string(), z.boolean()]).optional(),
    agent_mode: z.string().optional(),
    /** Cursor ACP 模型；`auto` 表示 Auto（default[]），缺省 cursor 适配器亦为 auto */
    model: z.string().optional(),
    url: z.string().optional(),
    transport: z.enum(["stdio", "sse"]).optional(),
    name: z.string().optional(),
    /** 连接超时（毫秒），默认 15000；用于 initialize / authenticate / session/new 等 */
    connect_timeout_ms: z.number().int().positive().optional(),
    /** prompt 超时（毫秒），默认 120000；用于 session/prompt */
    prompt_timeout_ms: z.number().int().positive().optional(),
    /** 是否在逸灵风启动时自动连接，默认 true */
    enabled: z.boolean().optional(),
    /** 健康检查间隔（毫秒），默认 60000；0 禁用 */
    health_check_interval_ms: z.number().int().nonnegative().optional(),
    /** Session TTL（毫秒），默认 0 不过期 */
    session_ttl_ms: z.number().int().nonnegative().optional(),
    /** prompt 超时后是否重试一次，默认 true */
    prompt_retry_once: z.boolean().optional(),
    /** 子进程崩溃后是否自动重启，默认 true */
    auto_restart: z.boolean().optional(),
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
  /** Camofox REST 基址（browser.camofox.base_url） */
  base_url: z.string().optional(),
  /** 单次 HTTP 请求超时（毫秒），默认 30000 */
  timeout_ms: z.number().int().positive().optional(),
  /** 启用 profile 级持久化 browser profile（跨任务复用 userId） */
  managed_persistence: z.boolean().optional(),
  /** 进程重启后尝试 adopt 已有 Camofox tab */
  adopt_existing_tab: z.boolean().optional(),
  /** 外部指定 Camofox userId（共享 browser profile） */
  user_id: z.string().optional(),
  /** 外部指定 sessionKey */
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

export const nestConfigSchema = z
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
    database: databaseConfigSchema.optional(),
    redis: redisConfigSchema,
  })
  .passthrough();

export type NestConfig = z.infer<typeof nestConfigSchema>;
export type { LlmConfig } from "./llm-config.ts";
export {
  llmConfigSchema,
  llmProfileSchema,
  llmProviderOpenAiSchema,
  llmRouteHopSchema,
  OPENAI_COMPATIBLE_BACKEND_ID,
} from "./llm-config.ts";
