import {
  autobiographicalSignificanceSchema,
  autobiographicalStatusSchema,
  limbicKindSchema,
  semanticMemoryStatusSchema,
  semanticMemoryTypeSchema,
} from "@freeanima/engine-db/schema";
import { z } from "zod";

const memoryListPaginationSchema = z.object({
  offset: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const semanticMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  types: z.array(semanticMemoryTypeSchema).optional(),
  status: semanticMemoryStatusSchema.or(z.literal("all")).optional(),
  source_session: z.string().optional(),
});

export const limbicMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  session_id: z.string().optional(),
  kind: limbicKindSchema.optional(),
});

export const autobiographicalMemoryListBodySchema = memoryListPaginationSchema.extend({
  query: z.string().optional(),
  status: autobiographicalStatusSchema.optional(),
  significance: autobiographicalSignificanceSchema.optional(),
  source_session: z.string().optional(),
});

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
export type SemanticMemoryListBody = z.infer<typeof semanticMemoryListBodySchema>;
export type LimbicMemoryListBody = z.infer<typeof limbicMemoryListBodySchema>;
export type AutobiographicalMemoryListBody = z.infer<typeof autobiographicalMemoryListBodySchema>;
export type StudioConfigPatch = z.infer<typeof studioConfigPatchSchema>;
export type StudioSearchBody = z.infer<typeof studioSearchBodySchema>;

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

export type StreamApiEvent = z.infer<typeof streamApiEventSchema>;

export const messagesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;
