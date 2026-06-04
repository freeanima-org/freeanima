import { z } from "zod";

const clarifyItemSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).max(4).optional(),
  default: z.string().optional(),
});

export const createSessionBodySchema = z.object({
  platform: z.string().optional(),
});

export const patchTitleBodySchema = z
  .object({ title: z.string() })
  .transform((b) => ({ title: b.title.trim() }))
  .refine((b) => b.title.length > 0, { message: "title is required" });

export const sendMessageBodySchema = z
  .object({
    message: z.string(),
  })
  .transform((b) => ({ message: b.message.trim() }))
  .refine((b) => b.message.length > 0, { message: "message is required" });

export const memorySearchBodySchema = z
  .object({
    query: z.string(),
    limit: z.number().int().positive().optional(),
    session_limit: z.number().int().positive().optional(),
    session: z.string().optional(),
  })
  .transform((b) => ({ ...b, query: b.query.trim() }))
  .refine((b) => b.query.length > 0, { message: "query is required" });

export const studioConfigPatchSchema = z.object({
  workspace: z.string().optional(),
  gitignore: z.boolean().optional(),
  showHidden: z.boolean().optional(),
});

export const studioSearchBodySchema = z
  .object({ query: z.string() })
  .transform((b) => ({ query: b.query.trim() }))
  .refine((b) => b.query.length > 0, { message: "query is required" });

export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;
export type PatchTitleBody = z.infer<typeof patchTitleBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type MemorySearchBody = z.infer<typeof memorySearchBodySchema>;
export type StudioConfigPatch = z.infer<typeof studioConfigPatchSchema>;
export type StudioSearchBody = z.infer<typeof studioSearchBodySchema>;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string(),
});

export const platformStatusSchema = z.object({ status: z.string() }).passthrough();

export const serviceStatusSchema = z.object({
  status: z.literal("running"),
  pid: z.number(),
  version: z.string(),
  uptime_seconds: z.number().nullable(),
  start_time_iso: z.string(),
  config: z.object({
    model: z.string().optional(),
    api_base: z.string().optional(),
  }),
  sessions: z.object({
    total: z.number(),
    by_platform: z.record(z.string(), z.number()),
  }),
  tools: z.number(),
  cron_jobs: z.number(),
  platforms: z.record(z.string(), platformStatusSchema),
  memory_kb: z.number(),
  memory: z.object({
    files_count: z.number(),
    files_bytes: z.number(),
    facts_count: z.number(),
    l2_index_rows: z.number(),
  }),
  host: z.string().optional(),
  port: z.number().optional(),
});

export const sessionListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  created: z.string(),
  platform: z.string(),
});

const streamTokenEventSchema = z.object({
  event: z.literal("token"),
  data: z.object({ content: z.string() }),
});

const streamToolBeginEventSchema = z.object({
  event: z.literal("tool_begin"),
  data: z.object({
    tool: z.string(),
    args: z.record(z.string(), z.unknown()),
    content: z.literal(""),
  }),
});

const streamToolResultEventSchema = z.object({
  event: z.literal("tool_result"),
  data: z.object({ tool: z.string(), content: z.string() }),
});

const streamToolErrorEventSchema = z.object({
  event: z.literal("tool_error"),
  data: z.object({ tool: z.string(), content: z.string() }),
});

const streamAwaitingClarifyEventSchema = z.object({
  event: z.literal("awaiting_clarify"),
  data: z.object({
    items: z.array(clarifyItemSchema),
    timeout_sec: z.number(),
  }),
});

const streamInterruptedEventSchema = z.object({
  event: z.literal("interrupted"),
  data: z.object({ reason: z.string() }),
});

const streamDoneEventSchema = z.object({
  event: z.literal("done"),
  data: z.object({
    reason: z.enum(["awaiting_clarify", "interrupted"]).optional(),
  }),
});

const streamContentReplaceEventSchema = z.object({
  event: z.literal("content_replace"),
  data: z.object({ content: z.string() }),
});

const streamErrorEventSchema = z.object({
  event: z.literal("error"),
  data: z.object({ error: z.string() }),
});

export const streamApiEventSchema = z.discriminatedUnion("event", [
  streamTokenEventSchema,
  streamContentReplaceEventSchema,
  streamToolBeginEventSchema,
  streamToolResultEventSchema,
  streamToolErrorEventSchema,
  streamAwaitingClarifyEventSchema,
  streamInterruptedEventSchema,
  streamDoneEventSchema,
  streamErrorEventSchema,
]);

export const commandRetryDataSchema = z.object({
  action: z.literal("retry"),
  new_session_id: z.string().optional(),
});

export const displayToolCallSchema = z.object({
  name: z.string(),
  argsPreview: z.string(),
  tool_call_id: z.string(),
  status: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  result: z.string().optional(),
});

export const displayMessageItemSchema = z.object({
  type: z.literal("message"),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const displayToolBlockItemSchema = z.object({
  type: z.literal("tool_block"),
  calls: z.array(displayToolCallSchema),
});

export const displayItemSchema = z.discriminatedUnion("type", [
  displayMessageItemSchema,
  displayToolBlockItemSchema,
]);

export const messagesResponseSchema = z.object({
  session_id: z.string(),
  display: z.array(displayItemSchema),
  total: z.number().optional(),
  offset: z.number().optional(),
  limit: z.number().nullable().optional(),
});

export const messagesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const cronJobApiSchema = z.object({
  id: z.string(),
  name: z.string(),
  schedule: z.string(),
  prompt: z.string().default(""),
  skills: z.array(z.string()).default([]),
  script: z.string().nullable().default(null),
  no_agent: z.boolean().default(false),
  enabled_toolsets: z.array(z.string()).nullable().default(null),
  model_provider: z.string().nullable().default(null),
  model_name: z.string().nullable().default(null),
  workdir: z.string().nullable().default(null),
  context_from: z.array(z.string()).default([]),
  deliver: z.string().default("local"),
  timeout_sec: z.number().default(300),
  builtin: z.boolean().default(false),
  repeat: z.number().nullable().default(null),
  run_count: z.number().default(0),
  paused: z.boolean().default(false),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
  next_run_at: z.number().default(0),
  last_run_at: z.number().default(0),
  last_output: z.string().default(""),
});

export const cronJobsResponseSchema = z.object({
  jobs: z.array(cronJobApiSchema),
});

export const safeConfigResponseSchema = z.object({
  config: z
    .object({
      api_key: z.string().optional(),
      model: z.string().optional(),
      api_base: z.string().optional(),
    })
    .passthrough(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type PlatformStatus = z.infer<typeof platformStatusSchema>;
export type ServiceStatus = z.infer<typeof serviceStatusSchema>;
export type SessionListItem = z.infer<typeof sessionListItemSchema>;
export type StreamApiEvent = z.infer<typeof streamApiEventSchema>;
export type CommandRetryData = z.infer<typeof commandRetryDataSchema>;
export type DisplayItem = z.infer<typeof displayItemSchema>;
export type DisplayToolCall = z.infer<typeof displayToolCallSchema>;
export type MessagesResponse = z.infer<typeof messagesResponseSchema>;
export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
export type CronJobApi = z.infer<typeof cronJobApiSchema>;
export type CronJobsResponse = z.infer<typeof cronJobsResponseSchema>;
export type SafeConfigResponse = z.infer<typeof safeConfigResponseSchema>;
