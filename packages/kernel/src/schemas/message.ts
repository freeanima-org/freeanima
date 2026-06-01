import { z } from "zod";
import {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionTodoStoreSchema,
} from "./session-meta.js";
import { parseJsonLine } from "./util.js";

export const openAiFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

export const openAiToolSchema = z.object({
  type: z.literal("function"),
  function: openAiFunctionSchema,
});

export const toolCallSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  function: z.object({
    name: z.string(),
    arguments: z.string().default("{}"),
  }),
});

function parseToolCalls(raw: unknown): z.infer<typeof toolCallSchema>[] {
  if (!Array.isArray(raw)) return [];
  const calls: z.infer<typeof toolCallSchema>[] = [];
  for (const item of raw) {
    const result = toolCallSchema.safeParse(item);
    if (result.success) calls.push(result.data);
  }
  return calls;
}

function parseOpenAiTools(raw: unknown): z.infer<typeof openAiToolSchema>[] {
  if (!Array.isArray(raw)) return [];
  const tools: z.infer<typeof openAiToolSchema>[] = [];
  for (const item of raw) {
    const result = openAiToolSchema.safeParse(item);
    if (result.success) tools.push(result.data);
  }
  return tools;
}

export const messageUsageSchema = z.record(z.string(), z.number());

/** 兼容旧 JSONL / payload 中的 id 字段 → pos */
export function normalizeLegacyMessagePos(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const o = { ...(raw as Record<string, unknown>) };
  if (o.pos === undefined && typeof o.id === "number") {
    o.pos = o.id;
  }
  delete o.id;
  return o;
}

const messageBaseSchema = z.object({
  timestamp: z.string().optional(),
  pos: z.number().optional(),
});

export const sessionMetaSchema = z
  .object({
    role: z.literal("session_meta"),
    model: z.string(),
    tools: z.preprocess(parseOpenAiTools, z.array(openAiToolSchema).default([])),
    functions: z.array(z.string()).default([]),
    timestamp: z.string().default(""),
    platform: z.string().optional(),
    system_prompt: z.string().optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    compression: z.unknown().optional(),
    platform_extra: z.record(z.string(), z.unknown()).optional(),
    debug: z.boolean().optional(),
    todos: z.unknown().optional(),
    awaiting_clarify: z.unknown().optional(),
    acp_sessions: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const userMessageSchema = messageBaseSchema.extend({
  role: z.literal("user"),
  content: z.string(),
  name: z.string().optional(),
});

export const systemMessageSchema = messageBaseSchema.extend({
  role: z.literal("system"),
  content: z.string(),
});

export const assistantMessageSchema = messageBaseSchema.extend({
  role: z.literal("assistant"),
  content: z.union([z.string(), z.null()]).optional().transform((v) => v ?? null),
  tool_calls: z.preprocess(
    (v) => {
      const calls = parseToolCalls(v);
      return calls.length ? calls : undefined;
    },
    z.array(toolCallSchema).optional(),
  ),
  model: z.string().optional(),
  finish_reason: z.string().optional(),
  reasoning: z.string().optional(),
  reasoning_content: z.string().optional(),
  usage: messageUsageSchema.optional(),
  latency_ms: z.number().optional(),
  name: z.string().optional(),
});

export const toolMessageSchema = messageBaseSchema.extend({
  role: z.literal("tool"),
  tool_call_id: z.string(),
  content: z.string(),
  name: z.string().optional(),
});

const conversationRoles = z.discriminatedUnion("role", [
  userMessageSchema,
  systemMessageSchema,
  assistantMessageSchema,
  toolMessageSchema,
]);

/** 对话消息（不含 session_meta），供 compressor / LLM 使用 */
export const conversationMessageSchema = z.preprocess(
  normalizeLegacyMessagePos,
  conversationRoles,
);

/** PG messages.payload（不含 pos；pos 由列维护） */
export const conversationPayloadSchema = z.preprocess(
  normalizeLegacyMessagePos,
  z.discriminatedUnion("role", [
    userMessageSchema.omit({ pos: true }),
    systemMessageSchema.omit({ pos: true }),
    assistantMessageSchema.omit({ pos: true }),
    toolMessageSchema.omit({ pos: true }),
  ]),
);

export const sessionMessageSchema = z.preprocess(
  normalizeLegacyMessagePos,
  z.discriminatedUnion("role", [
    sessionMetaSchema,
    userMessageSchema,
    systemMessageSchema,
    assistantMessageSchema,
    toolMessageSchema,
  ]),
);

export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationPayload = z.infer<typeof conversationPayloadSchema>;

export type OpenAiFunctionSchema = z.infer<typeof openAiFunctionSchema>;
export type OpenAiToolSchema = z.infer<typeof openAiToolSchema>;
export type ToolCall = z.infer<typeof toolCallSchema>;
export type MessageUsage = z.infer<typeof messageUsageSchema>;
export type SessionMetaMessage = z.infer<typeof sessionMetaSchema>;
export type UserMessage = z.infer<typeof userMessageSchema>;
export type SystemMessage = z.infer<typeof systemMessageSchema>;
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;
export type ToolMessage = z.infer<typeof toolMessageSchema>;
export type SessionMessage = z.infer<typeof sessionMessageSchema>;

export type SessionMetaLoadResult = SessionMetaMessage | Record<string, never>;

/** 解析 JSONL 单行；无效行返回 null */
export function parseSessionLine(line: string): SessionMessage | null {
  return parseJsonLine(line, sessionMessageSchema);
}

export function isSessionMeta(meta: SessionMetaLoadResult): meta is SessionMetaMessage {
  return meta.role === "session_meta";
}

export function isUserMessage(msg: SessionMessage): msg is UserMessage {
  return msg.role === "user";
}

export function isAssistantMessage(msg: SessionMessage): msg is AssistantMessage {
  return msg.role === "assistant";
}

export function isToolMessage(msg: SessionMessage): msg is ToolMessage {
  return msg.role === "tool";
}

export function isSystemMessage(msg: SessionMessage): msg is SystemMessage {
  return msg.role === "system";
}

export {
  awaitingClarifySchema,
  compressionStateSchema,
  sessionTodoStoreSchema,
};
