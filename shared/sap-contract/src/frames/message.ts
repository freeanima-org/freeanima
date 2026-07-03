import { z } from "zod";

export const messageSendInputSchema = z.object({
  conversation_id: z.string().min(1),
  message: z.string().min(1),
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
  | { event: "error"; data: { error: string } }
  | { event: "ping"; data: Record<string, never> };

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
        data: { content: String(ev.data.content ?? "") },
      });
    case "content_replace":
      return mapStreamApiEventToSap(streamId, {
        event: "content_replace",
        data: { content: String(ev.data.content ?? "") },
      });
    case "tool_begin":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_begin",
        data: {
          tool: String(ev.data.name ?? ev.data.tool ?? "?"),
          args: (ev.data.args as Record<string, unknown>) ?? {},
          content: "",
        },
      });
    case "tool_result":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_result",
        data: {
          tool: String(ev.data.name ?? ev.data.tool ?? "?"),
          content: String(ev.data.content ?? ""),
        },
      });
    case "tool_error":
      return mapStreamApiEventToSap(streamId, {
        event: "tool_error",
        data: {
          tool: String(ev.data.name ?? ev.data.tool ?? "?"),
          content: String(ev.data.content ?? ""),
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
        data: { reason: String(ev.data.reason ?? "") },
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
        data: { error: String(ev.data.error ?? ev.data.message ?? "error") },
      });
    default:
      return null;
  }
}

/** 将 Hub 下发的 SAP stream.* evt 映射为 Admin SSE 事件名与 payload */
export function mapSapStreamMethodToApi(
  method: StreamEventMethod,
  payload: Record<string, unknown>,
): StreamApiLikeEvent | null {
  switch (method) {
    case "stream.accepted":
      return { event: "accepted", data: {} };
    case "stream.token":
      return { event: "token", data: { content: String(payload.content ?? "") } };
    case "stream.content_replace":
      return { event: "content_replace", data: { content: String(payload.content ?? "") } };
    case "stream.display_append":
      return {
        event: "display_append",
        data: { item: payload.item as SapDisplayItem },
      };
    case "stream.tool_begin":
      return {
        event: "tool_begin",
        data: {
          tool: String(payload.tool ?? "?"),
          args: (payload.args as Record<string, unknown>) ?? {},
          content: "",
        },
      };
    case "stream.tool_result":
      return {
        event: "tool_result",
        data: {
          tool: String(payload.tool ?? "?"),
          content: String(payload.content ?? ""),
        },
      };
    case "stream.tool_error":
      return {
        event: "tool_error",
        data: {
          tool: String(payload.tool ?? "?"),
          content: String(payload.content ?? ""),
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
      return { event: "interrupted", data: { reason: String(payload.reason ?? "") } };
    case "stream.done": {
      const reason = payload.reason as "awaiting_clarify" | "interrupted" | undefined;
      return {
        event: "done",
        data: reason !== undefined ? { reason } : {},
      };
    }
    case "stream.error":
      return { event: "error", data: { error: String(payload.error ?? "error") } };
    case "stream.ping":
      return { event: "ping", data: {} };
    default:
      return null;
  }
}
