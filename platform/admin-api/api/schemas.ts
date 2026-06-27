import {
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  limbicKindSchema,
  semanticMemoryStatusSchema,
  semanticMemoryTypeSchema,
} from "@freeanima/core/db/schema";
import { z } from "zod";

const memoryListPaginationSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const semanticMemorySortBySchema = z.enum(["created", "updated", "reference_count", "rank"]);

export const semanticMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  types: z.array(semanticMemoryTypeSchema).optional(),
  status: semanticMemoryStatusSchema.or(z.literal("all")).optional(),
  source_conversation: z.string().optional(),
  sort_by: semanticMemorySortBySchema.optional(),
});

export const semanticMemoryPinBodySchema = z.object({
  id: z.string().min(1),
  pinned: z.boolean(),
});

export const limbicMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  conversation_id: z.string().optional(),
  kind: limbicKindSchema.optional(),
});

export const autobiographicalMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  status: autobiographicalStatusSchema.optional(),
  significance: autobiographicalSignificanceSchema.optional(),
  source_conversation: z.string().optional(),
});

export const dreamMemoryListBodySchema = memoryListPaginationSchema;

export const dreamMemoryDayParamsSchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const clarifyItemSchema = z.object({
  question: z.string().min(1),
  choices: z.array(z.string().min(1)).max(4).optional(),
  default: z.string().optional(),
});

export const createConversationBodySchema = z.object({
  platform: z.string().min(1),
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
  })
  .transform((b) => ({ ...b, query: b.query.trim() }))
  .refine((b) => b.query.length > 0, { message: "query is required" });

export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;
export type PatchTitleBody = z.infer<typeof patchTitleBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
export type MemorySearchBody = z.infer<typeof memorySearchBodySchema>;
export type SemanticMemoryListBody = z.infer<typeof semanticMemoryListBodySchema>;
export type SemanticMemoryPinBody = z.infer<typeof semanticMemoryPinBodySchema>;
export type LimbicMemoryListBody = z.infer<typeof limbicMemoryListBodySchema>;
export type AutobiographicalMemoryListBody = z.infer<typeof autobiographicalMemoryListBodySchema>;
export type DreamMemoryListBody = z.infer<typeof dreamMemoryListBodySchema>;

const streamAcceptedEventSchema = z.object({
  event: z.literal("accepted"),
  data: z.object({}),
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

const streamPingEventSchema = z.object({
  event: z.literal("ping"),
  data: z.object({}),
});

export const streamApiEventSchema = z.discriminatedUnion("event", [
  streamAcceptedEventSchema,
  streamTokenEventSchema,
  streamContentReplaceEventSchema,
  streamToolBeginEventSchema,
  streamToolResultEventSchema,
  streamToolErrorEventSchema,
  streamAwaitingClarifyEventSchema,
  streamInterruptedEventSchema,
  streamDoneEventSchema,
  streamErrorEventSchema,
  streamPingEventSchema,
]);

export type StreamApiEvent = z.infer<typeof streamApiEventSchema>;

export const messagesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

const runtimeContextBreakdownSchema = z.object({
  system_self: z.number(),
  system_agents: z.number(),
  system_resident: z.number(),
  system_toolsets: z.number(),
  summary: z.number(),
  messages: z.number(),
  tools: z.number(),
  total: z.number(),
});

const promptDebugToolItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  toolset: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()),
});

export const promptDebugResponseSchema = z.object({
  mode: z.enum(["global", "conversation"]),
  conversation_id: z.string().optional(),
  system: z.object({
    parts: z.object({
      self: z.string(),
      agents: z.string(),
      resident: z.string(),
      toolsets: z.string(),
    }),
    composed: z.string(),
    stored: z.string().nullable().optional(),
    in_sync: z.boolean().optional(),
    breakdown: runtimeContextBreakdownSchema,
  }),
  tools: z.object({
    mode: z.enum(["registry", "conversation"]),
    count: z.number(),
    tokens_est: z.number(),
    items: z.array(promptDebugToolItemSchema),
  }),
  meta: z
    .object({
      cwd: z.string().nullable().optional(),
      capability_mask: z.object({ presets: z.array(z.string()) }).optional(),
      tool_names: z.array(z.string()).optional(),
    })
    .optional(),
});

export type PromptDebugResponse = z.infer<typeof promptDebugResponseSchema>;

const jsonSchemaObjectSchema = z.record(z.string(), z.unknown());

const openAiToolEntrySchema = z.object({
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: jsonSchemaObjectSchema,
  }),
});

const toolsStatusToolItemSchema = z.object({
  name: z.string(),
  description: z.string(),
  toolset: z.string().optional(),
  parameters: jsonSchemaObjectSchema,
  requires_env: z.array(z.string()).optional(),
  definition: openAiToolEntrySchema,
  return_kind: z.enum(["json", "text"]),
  return_schema: jsonSchemaObjectSchema.optional(),
  return_example: z.unknown().optional(),
  return_text_hint: z.string().optional(),
  error_schema: jsonSchemaObjectSchema,
  error_example: z.object({ error: z.string() }),
});

export const toolsStatusResponseSchema = z.object({
  default_toolsets: z.array(z.string()),
  tools: z.array(toolsStatusToolItemSchema),
  toolsets: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      tools: z.array(z.string()),
    }),
  ),
});

export type ToolsStatusResponse = z.infer<typeof toolsStatusResponseSchema>;
export type ToolsStatusToolItem = z.infer<typeof toolsStatusToolItemSchema>;

export type FridgeMagnetItem = {
  key: string;
  value: string;
  module: "conversation" | "other";
  conversation_id?: string;
  label?: string;
  ttl_seconds: number | null;
};

export type FridgeMagnetsResponse = {
  redis_configured: boolean;
  magnets: FridgeMagnetItem[];
  inject_text: string;
};
