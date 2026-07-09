import type { StreamEvent } from "@freeanima/runtime/loop";
import type { StreamApiEvent } from "@freeanima/features/console/hub/console-api/api";

export function mapStreamEventToApi(ev: StreamEvent): StreamApiEvent {
  switch (ev.event) {
    case "accepted":
      return { event: "accepted", data: {} };
    case "token":
      return { event: "token", data: { content: ev.data.content } };
    case "content_replace":
      return { event: "content_replace", data: { content: ev.data.content } };
    case "tool_begin":
      return {
        event: "tool_begin",
        data: {
          tool: ev.data.name,
          args: ev.data.args,
          content: "",
        },
      };
    case "tool_result":
      return {
        event: "tool_result",
        data: { tool: ev.data.name, content: ev.data.content },
      };
    case "tool_error":
      return {
        event: "tool_error",
        data: { tool: ev.data.name, content: ev.data.content },
      };
    case "awaiting_clarify":
      return {
        event: "awaiting_clarify",
        data: {
          items: ev.data.items,
          timeout_sec: ev.data.timeout_sec,
        },
      };
    case "interrupted":
      return { event: "interrupted", data: { reason: ev.data.reason } };
    case "tool_round_end":
    case "llm_debug":
      return { event: "ping", data: {} };
    case "done":
      return { event: "done", data: ev.data };
    case "error":
      return { event: "error", data: ev.data };
    default: {
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
