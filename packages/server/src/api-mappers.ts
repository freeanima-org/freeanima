import type {
  CronJobsResponse,
  HealthResponse,
  MessagesResponse,
  SafeConfigResponse,
  ServiceStatus,
  SessionListItem,
  StreamApiEvent,
} from "@freeanima/api";
import type {
  HealthSnapshot,
  SafeConfigSnapshot,
  ServiceSnapshot,
  SessionSummary,
} from "@freeanima/core";
import type { StreamEvent } from "@freeanima/core";
import type { MessagesDisplay } from "@freeanima/core";
import type { CronJobData } from "@freeanima/core";

export function mapStreamEventToApi(ev: StreamEvent): StreamApiEvent {
  switch (ev.event) {
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

export function mapHealthToApi(snapshot: HealthSnapshot): HealthResponse {
  return snapshot;
}

export function mapStatusToApi(snapshot: ServiceSnapshot): ServiceStatus {
  return snapshot;
}

export function mapSessionsToApi(sessions: SessionSummary[]): SessionListItem[] {
  return sessions;
}

export function mapMessagesToApi(display: MessagesDisplay): MessagesResponse {
  return display;
}

export function mapConfigToApi(snapshot: SafeConfigSnapshot): SafeConfigResponse {
  return snapshot as SafeConfigResponse;
}

export function mapCronJobsToApi(jobs: CronJobData[]): CronJobsResponse {
  return { jobs: jobs as CronJobsResponse["jobs"] };
}
