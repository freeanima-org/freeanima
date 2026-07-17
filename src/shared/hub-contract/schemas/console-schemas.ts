import {
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  limbicKindSchema,
} from "@freeanima/core/db/schema/entity";
import { clarifyItemSchema } from "@freeanima/core/db/schema/jsonb/conversation-meta-jsonb.ts";
import {
  semanticMemoryStatusSchema,
  semanticMemoryTypeSchema,
} from "@freeanima/core/db/schema/semantic-memory.ts";
import { z } from "zod";

const memoryListPaginationSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const semanticMemorySortBySchema = z.enum([
  "created_at",
  "updated_at",
  "reference_count",
  "rank",
]);

export const semanticMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  types: z.array(semanticMemoryTypeSchema).optional(),
  status: semanticMemoryStatusSchema.or(z.literal("all")).optional(),
  source_conversation: z.string().optional(),
  sort_by: semanticMemorySortBySchema.optional(),
});

export const semanticMemoryPinBodySchema = z.object({
  id: z.number().int().positive(),
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

export const entityIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const entityListQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const worldGrantInputSchema = z.object({
  subject_id: z.number().int().positive(),
  permission: z.enum(["read", "write"]),
});

export const worldEntityCreateBodySchema = z
  .object({
    title: z.string(),
    summary: z.string().optional(),
    content: z.string().optional(),
    private: z.boolean().optional().default(false),
    owner_subject_id: z.number().int().positive().optional(),
    grants: z.array(worldGrantInputSchema).optional(),
  })
  .transform((b) => ({
    title: b.title.trim(),
    summary: b.summary?.trim() ?? "",
    content: b.content?.trim() ?? "",
    private: b.private ?? false,
    owner_subject_id: b.owner_subject_id,
    grants: b.grants,
  }))
  .refine((b) => b.title.length > 0, { message: "title is required" })
  .superRefine((b, ctx) => {
    if (b.private && b.owner_subject_id == null) {
      ctx.addIssue({ code: "custom", message: "private world requires owner_subject_id" });
    }
    if (!b.private && b.owner_subject_id != null) {
      ctx.addIssue({ code: "custom", message: "public world must not have owner_subject_id" });
    }
  });

const worldEntityUpdateFieldsSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    private: z.boolean().optional(),
    owner_subject_id: z.number().int().positive().nullable().optional(),
    grants: z.array(worldGrantInputSchema).optional(),
  })
  .transform((b) => ({
    title: b.title !== undefined ? b.title.trim() : undefined,
    summary: b.summary !== undefined ? b.summary.trim() : undefined,
    content: b.content !== undefined ? b.content.trim() : undefined,
    private: b.private,
    owner_subject_id: b.owner_subject_id,
    grants: b.grants,
  }))
  .refine((b) => b.title === undefined || b.title.length > 0, { message: "title is required" })
  .superRefine((b, ctx) => {
    if (b.private === true && (b.owner_subject_id === undefined || b.owner_subject_id == null)) {
      ctx.addIssue({ code: "custom", message: "private world requires owner_subject_id" });
    }
    if (b.private === false && b.owner_subject_id != null) {
      ctx.addIssue({ code: "custom", message: "public world must not have owner_subject_id" });
    }
  });

export const worldEntityUpdateBodySchema = worldEntityUpdateFieldsSchema;

/** Hub PATCH：字段 + id */
export const worldEntityPatchInputSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    private: z.boolean().optional(),
    owner_subject_id: z.number().int().positive().nullable().optional(),
    grants: z.array(worldGrantInputSchema).optional(),
  })
  .transform((b) => ({
    id: b.id,
    title: b.title !== undefined ? b.title.trim() : undefined,
    summary: b.summary !== undefined ? b.summary.trim() : undefined,
    content: b.content !== undefined ? b.content.trim() : undefined,
    private: b.private,
    owner_subject_id: b.owner_subject_id,
    grants: b.grants,
  }))
  .refine((b) => b.title === undefined || b.title.length > 0, { message: "title is required" })
  .superRefine((b, ctx) => {
    if (b.private === true && (b.owner_subject_id === undefined || b.owner_subject_id == null)) {
      ctx.addIssue({ code: "custom", message: "private world requires owner_subject_id" });
    }
    if (b.private === false && b.owner_subject_id != null) {
      ctx.addIssue({ code: "custom", message: "public world must not have owner_subject_id" });
    }
  });

export const subjectEntityCreateBodySchema = z
  .object({
    type: z.enum(["agent", "user"]),
    title: z.string(),
    summary: z.string().optional(),
    content: z.string().optional(),
  })
  .transform((b) => ({
    type: b.type,
    title: b.title.trim(),
    summary: b.summary?.trim() ?? "",
    content: b.content?.trim() ?? "",
  }))
  .refine((b) => b.title.length > 0, { message: "title is required" });

export const subjectEntityUpdateBodySchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    content: z.string().optional(),
    default_private_world_id: z.number().int().positive().optional(),
  })
  .transform((b) => ({
    title: b.title !== undefined ? b.title.trim() : undefined,
    summary: b.summary !== undefined ? b.summary.trim() : undefined,
    content: b.content !== undefined ? b.content.trim() : undefined,
    default_private_world_id: b.default_private_world_id,
  }))
  .refine((b) => b.title === undefined || b.title.length > 0, { message: "title is required" });

export type WorldEntityCreateBody = z.infer<typeof worldEntityCreateBodySchema>;
export type WorldEntityUpdateBody = z.infer<typeof worldEntityUpdateBodySchema>;
export type SubjectEntityCreateBody = z.infer<typeof subjectEntityCreateBodySchema>;
export type SubjectEntityUpdateBody = z.infer<typeof subjectEntityUpdateBodySchema>;

export const entitySearchQuerySchema = z.object({
  query: z.string().optional(),
  world_id: z.coerce.number().int().positive().optional(),
  global: z
    .union([z.boolean(), z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v === true || v === "true"),
  type: z.enum(["content", "world", "agent", "user"]).optional(),
  primary_component: z.string().optional(),
  component: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  mode: z.enum(["hybrid", "filter_only"]).optional(),
});

export const entitySearchBodySchema = entitySearchQuerySchema.extend({
  types: z.array(z.enum(["content", "world", "agent", "user"])).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
  updated_after: z.string().optional(),
  updated_before: z.string().optional(),
});

export type EntitySearchBody = z.infer<typeof entitySearchBodySchema>;

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
