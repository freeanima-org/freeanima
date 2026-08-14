import { z } from "zod";
import { omitUndefined } from "@freeanima/shared/util/omit-undefined.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

export const messageSendInputSchema = z.object({
  conversation_id: z.string().min(1),
  message: z.string().min(1),
  client_op_id: z.string().min(1).optional(),
  expected_tail_pos: z.number().int().min(0).optional(),
  force_tail: z.boolean().optional(),
  llm_debug: z.boolean().optional(),
});

export type MessageSendInput = z.infer<typeof messageSendInputSchema>;

export const messageSendOutputSchema = z.object({
  stream_id: z.string(),
});

export type MessageSendOutput = z.infer<typeof messageSendOutputSchema>;

export const messageInterruptInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type MessageInterruptInput = z.infer<typeof messageInterruptInputSchema>;

export const messageInterruptOutputSchema = z.object({
  ok: z.literal(true),
});

export type MessageInterruptOutput = z.infer<typeof messageInterruptOutputSchema>;

export const streamAttachInputSchema = z.object({
  stream_id: z.string().min(1),
});

export type StreamAttachInput = z.infer<typeof streamAttachInputSchema>;

export const streamAttachOutputSchema = z.object({
  status: z.enum(["active", "done", "error", "interrupted"]),
  replayed: z.boolean(),
});

export type StreamAttachOutput = z.infer<typeof streamAttachOutputSchema>;

export const streamLookupInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type StreamLookupInput = z.infer<typeof streamLookupInputSchema>;

export const streamLookupOutputSchema = z.object({
  stream_id: z.string().optional(),
  status: z.enum(["active", "done", "error", "interrupted"]).optional(),
});

export type StreamLookupOutput = z.infer<typeof streamLookupOutputSchema>;

export const llmDebugGetInputSchema = z.object({
  conversation_id: z.string().min(1),
});

export type LlmDebugGetInput = z.infer<typeof llmDebugGetInputSchema>;

const llmDebugSnapshotSchema = z
  .object({
    phase: z.enum(["initial", "final"]),
    turn_index: z.number(),
    model: z.string(),
    tool_count: z.number(),
    tools: z.array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.string(), z.unknown()).optional(),
        }),
      }),
    ),
    invoke: z.object({
      system_prompt: z.string().optional(),
      turns: z.array(z.record(z.string(), z.unknown())),
    }),
    runtime_injections: z
      .object({
        passive_memory_context: z.boolean().optional(),
        notification_context: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

export const llmDebugGetOutputSchema = z.object({
  initial: llmDebugSnapshotSchema.optional(),
  final: llmDebugSnapshotSchema.optional(),
  updated_at: z.string().optional(),
});

export type LlmDebugGetOutput = z.infer<typeof llmDebugGetOutputSchema>;

export const streamEventMethods = [
  "stream.accepted",
  "stream.token",
  "stream.content_replace",
  "stream.display_append",
  "stream.tool_begin",
  "stream.tool_result",
  "stream.tool_error",
  "stream.awaiting_clarify",
  "stream.interrupted",
  "stream.done",
  "stream.error",
  "stream.ping",
  "stream.llm_debug",
] as const;

export type StreamEventMethod = (typeof streamEventMethods)[number];

export const streamEventPayloadSchema = z
  .object({
    stream_id: z.string(),
  })
  .passthrough();

export type StreamEventPayload = z.infer<typeof streamEventPayloadSchema>;

export type SapDisplayToolCall = {
  name: string;
  argsPreview: string;
  tool_call_id: string;
  status: string;
  args?: Record<string, unknown>;
  result?: string;
};

export type SapDisplayItem =
  | { type: "message"; role: "user" | "assistant"; content: string }
  | { type: "tool_block"; calls: SapDisplayToolCall[] };

export type LlmDebugTurnPreview = {
  role: string;
  name?: string;
  content?: string | null;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
};

/** Passive recall channel/filter trace for LLM debug panel */
export type PassiveRecallDebugHit = {
  id: number;
  score: number;
  content_preview: string;
};

export type PassiveRecallDebugTrace = {
  query: string;
  /** FTS/trgm query after content-word extraction (optional for older traces). */
  content_query?: string;
  tsquery: string | null;
  /** Whether jieba singleton loaded in this process (null when not applicable / unknown). */
  jieba_loaded?: boolean | null;
  /** Whether vector boost channel was enabled for this run. */
  use_vector?: boolean;
  effective_min_score: number;
  min_score: number;
  min_relative_score: number;
  fts: PassiveRecallDebugHit[];
  trgm: PassiveRecallDebugHit[];
  /** Vector channel hits before RRF / vector-only drop (empty when disabled). */
  vector?: PassiveRecallDebugHit[];
  merged: PassiveRecallDebugHit[];
  after_score_filter: PassiveRecallDebugHit[];
  after_resident_filter: PassiveRecallDebugHit[];
  excluded_resident_ids: number[];
  injected: PassiveRecallDebugHit[];
  skipped_reason?: string;
  elapsed_ms: number;
};

export type LlmDebugSnapshotPayload = {
  phase: "initial" | "final";
  turn_index: number;
  model: string;
  tool_count: number;
  tools: Array<{
    type: "function";
    function: {
      name: string;
      description?: string;
      parameters?: Record<string, unknown>;
    };
  }>;
  invoke: {
    system_prompt?: string;
    turns: LlmDebugTurnPreview[];
  };
  runtime_injections?: {
    passive_memory_context?: boolean;
    notification_context?: boolean;
  };
  passive_recall?: PassiveRecallDebugTrace;
};

export type StreamApiLikeEvent =
  | { event: "accepted"; data: Record<string, never> }
  | { event: "token"; data: { content: string } }
  | { event: "content_replace"; data: { content: string } }
  | { event: "display_append"; data: { item: SapDisplayItem } }
  | { event: "tool_begin"; data: { tool: string; args: Record<string, unknown>; content: "" } }
  | { event: "tool_result"; data: { tool: string; content: string } }
  | { event: "tool_error"; data: { tool: string; content: string } }
  | {
      event: "awaiting_clarify";
      data: {
        items: Array<{
          question: string;
          choices?: string[];
          default?: string;
        }>;
        timeout_sec: number;
      };
    }
  | { event: "interrupted"; data: { reason: string } }
  | { event: "done"; data: { reason?: "awaiting_clarify" | "interrupted" } }
  | {
      event: "error";
      data: {
        error: string;
        code?: string;
        current_tail_pos?: number;
      };
    }
  | { event: "ping"; data: Record<string, never> }
  | { event: "llm_debug"; data: LlmDebugSnapshotPayload };

const STREAM_METHOD_MAP: Record<StreamApiLikeEvent["event"], StreamEventMethod> = {
  accepted: "stream.accepted",
  token: "stream.token",
  content_replace: "stream.content_replace",
  display_append: "stream.display_append",
  tool_begin: "stream.tool_begin",
  tool_result: "stream.tool_result",
  tool_error: "stream.tool_error",
  awaiting_clarify: "stream.awaiting_clarify",
  interrupted: "stream.interrupted",
  done: "stream.done",
  error: "stream.error",
  ping: "stream.ping",
  llm_debug: "stream.llm_debug",
};

export function mapStreamApiEventToSap(
  streamId: string,
  ev: StreamApiLikeEvent,
): { method: StreamEventMethod; payload: Record<string, unknown> } {
  const method = STREAM_METHOD_MAP[ev.event];
  return {
    method,
    payload: { stream_id: streamId, ...ev.data },
  };
}

export function mapRuntimeStreamEventToSap(
  streamId: string,
  ev: {
    event: string;
    data: Record<string, unknown>;
  },
): { method: StreamEventMethod; payload: Record<string, unknown> } | null {
  switch (ev.event) {
    case "accepted":
      return mapStreamApiEventToSap(streamId, { event: "accepted", data: {} });
    case "token":
      return mapStreamApiEventToSap(streamId, {
        event: "token",
        data: { content: coerceString(ev.data.content ?? "") },
      });
    case "content_replace":
      return mapStreamApiEventToSap(streamId, {
        event: "content_replace",
        data: { content: coerceString(ev.data.content ?? "") },
      });
    case "tool_begin":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_begin",
        data: {
          tool: coerceString(ev.data.name ?? ev.data.tool ?? "?"),
          args: (ev.data.args as Record<string, unknown>) ?? {},
          content: "",
        },
      });
    case "tool_result":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_result",
        data: {
          tool: coerceString(ev.data.name ?? ev.data.tool ?? "?"),
          content: coerceString(ev.data.content ?? ""),
        },
      });
    case "tool_error":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_error",
        data: {
          tool: coerceString(ev.data.name ?? ev.data.tool ?? "?"),
          content: coerceString(ev.data.content ?? ""),
        },
      });
    case "awaiting_clarify":
      return mapStreamApiEventToSap(streamId, {
        event: "awaiting_clarify",
        data: {
          items:
            (ev.data.items as StreamApiLikeEvent extends { event: "awaiting_clarify" }
              ? StreamApiLikeEvent["data"]["items"]
              : never) ?? [],
          timeout_sec: Number(ev.data.timeout_sec ?? 0),
        },
      });
    case "interrupted":
      return mapStreamApiEventToSap(streamId, {
        event: "interrupted",
        data: { reason: coerceString(ev.data.reason ?? "") },
      });
    case "done": {
      const reason = ev.data.reason as "awaiting_clarify" | "interrupted" | undefined;
      return mapStreamApiEventToSap(streamId, {
        event: "done",
        data: reason !== undefined ? { reason } : {},
      });
    }
    case "error":
      return mapStreamApiEventToSap(streamId, {
        event: "error",
        data: omitUndefined({
          error: coerceString(ev.data.error ?? ev.data.message ?? "error"),
          code: typeof ev.data.code === "string" ? ev.data.code : undefined,
          current_tail_pos:
            typeof ev.data.current_tail_pos === "number" ? ev.data.current_tail_pos : undefined,
        }),
      });
    case "llm_debug":
      return mapStreamApiEventToSap(streamId, {
        event: "llm_debug",
        data: ev.data as LlmDebugSnapshotPayload,
      });
    default:
      return null;
  }
}

/** 将 Habitat 下发的 SAP stream.* evt 映射为 Habitat SSE 事件名与 payload */
export function mapSapStreamMethodToApi(
  method: StreamEventMethod,
  payload: Record<string, unknown>,
): StreamApiLikeEvent | null {
  switch (method) {
    case "stream.accepted":
      return { event: "accepted", data: {} };
    case "stream.token":
      return { event: "token", data: { content: coerceString(payload.content ?? "") } };
    case "stream.content_replace":
      return { event: "content_replace", data: { content: coerceString(payload.content ?? "") } };
    case "stream.display_append":
      return {
        event: "display_append",
        data: { item: payload.item as SapDisplayItem },
      };
    case "stream.tool_begin":
      return {
        event: "tool_begin",
        data: {
          tool: coerceString(payload.tool ?? "?"),
          args: (payload.args as Record<string, unknown>) ?? {},
          content: "",
        },
      };
    case "stream.tool_result":
      return {
        event: "tool_result",
        data: {
          tool: coerceString(payload.tool ?? "?"),
          content: coerceString(payload.content ?? ""),
        },
      };
    case "stream.tool_error":
      return {
        event: "tool_error",
        data: {
          tool: coerceString(payload.tool ?? "?"),
          content: coerceString(payload.content ?? ""),
        },
      };
    case "stream.awaiting_clarify":
      return {
        event: "awaiting_clarify",
        data: {
          items:
            (payload.items as StreamApiLikeEvent extends { event: "awaiting_clarify" }
              ? StreamApiLikeEvent["data"]["items"]
              : never) ?? [],
          timeout_sec: Number(payload.timeout_sec ?? 0),
        },
      };
    case "stream.interrupted":
      return { event: "interrupted", data: { reason: coerceString(payload.reason ?? "") } };
    case "stream.done": {
      const reason = payload.reason as "awaiting_clarify" | "interrupted" | undefined;
      return {
        event: "done",
        data: reason !== undefined ? { reason } : {},
      };
    }
    case "stream.error":
      return {
        event: "error",
        data: omitUndefined({
          error: coerceString(payload.error ?? "error"),
          code: typeof payload.code === "string" ? payload.code : undefined,
          current_tail_pos:
            typeof payload.current_tail_pos === "number" ? payload.current_tail_pos : undefined,
        }),
      };
    case "stream.llm_debug":
      return {
        event: "llm_debug",
        data: payload as LlmDebugSnapshotPayload,
      };
    case "stream.ping":
      return { event: "ping", data: {} };
    default:
      return null;
  }
}
