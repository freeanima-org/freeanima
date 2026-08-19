import { toolError, toolResult } from "@freeanima/habitat/core/tool";
import { omitUndefined } from "@freeanima/habitat/core/util";

import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from "./event-store.ts";
import { convertCalendarEventToTaskItem } from "./convert-task-event.ts";
import { listCalendarRange } from "./range-store.ts";
import { resolveCalendarToolWorld, WORLD_ID_OPTIONAL } from "./tool-world-resolve.ts";
import type { BuiltinCalendarSourceId, CalendarRangeKind } from "./types.ts";
import { coerceString } from "@freeanima/shared/coerce-string";

async function storeContext(args: Record<string, unknown>, access: "read" | "write" = "read") {
  const worldId = await resolveCalendarToolWorld({ args, access });
  if (typeof worldId === "string") return worldId;
  return { worldId };
}

function eventPayload(item: {
  id: number;
  title: string;
  content: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
  remind_at: string | null;
  reminders?: Array<{
    at: string;
    anchor?: "start" | "end" | "due";
    last_notified_at?: string | null;
  }>;
}) {
  return {
    id: item.id,
    title: item.title,
    content: item.content,
    start_at: item.start_at,
    end_at: item.end_at,
    all_day: item.all_day,
    remind_at: item.remind_at,
    ...(item.reminders != null && item.reminders.length > 0 ? { reminders: item.reminders } : {}),
  };
}

async function handleList(args: Record<string, unknown>): Promise<string> {
  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;
  try {
    const items = await listCalendarEvents(
      ctx,
      omitUndefined({
        range_start: args.range_start != null ? coerceString(args.range_start) : undefined,
        range_end: args.range_end != null ? coerceString(args.range_end) : undefined,
        limit: args.limit != null ? Number(args.limit) : undefined,
      }),
    );
    return toolResult({ ok: true, action: "list", items: items.map(eventPayload) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleCreate(args: Record<string, unknown>): Promise<string> {
  const title = coerceString(args.title ?? "").trim();
  const startAt = coerceString(args.start_at ?? "").trim();
  if (!title) return toolError("title is required");
  if (!startAt) return toolError("start_at is required");

  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;
  try {
    const item = await createCalendarEvent(
      ctx,
      omitUndefined({
        title,
        start_at: startAt,
        content: args.content != null ? coerceString(args.content) : undefined,
        end_at:
          args.end_at === undefined
            ? undefined
            : args.end_at == null
              ? null
              : coerceString(args.end_at),
        all_day: typeof args.all_day === "boolean" ? args.all_day : undefined,
        remind_at:
          args.remind_at === undefined
            ? undefined
            : args.remind_at == null
              ? null
              : coerceString(args.remind_at),
      }),
    );
    return toolResult({ ok: true, action: "create", item: eventPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleUpdate(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");

  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;
  try {
    const item = await updateCalendarEvent(
      ctx,
      omitUndefined({
        id,
        title: args.title != null ? coerceString(args.title) : undefined,
        content: args.content != null ? coerceString(args.content) : undefined,
        start_at: args.start_at != null ? coerceString(args.start_at) : undefined,
        end_at:
          args.end_at === undefined
            ? undefined
            : args.end_at == null
              ? null
              : coerceString(args.end_at),
        all_day: typeof args.all_day === "boolean" ? args.all_day : undefined,
        remind_at:
          args.remind_at === undefined
            ? undefined
            : args.remind_at == null
              ? null
              : coerceString(args.remind_at),
      }),
    );
    if (!item) return toolError("calendar event not found");
    return toolResult({ ok: true, action: "update", item: eventPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleDelete(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;
  try {
    const ok = await deleteCalendarEvent(ctx, id);
    if (!ok) return toolError("calendar event not found");
    return toolResult({ ok: true, action: "delete", id });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleGet(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;
  try {
    const item = await getCalendarEvent(ctx, id);
    if (!item) return toolError("calendar event not found");
    return toolResult({ ok: true, action: "get", item: eventPayload(item) });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleRange(args: Record<string, unknown>): Promise<string> {
  const from = coerceString(args.from ?? "").trim();
  const to = coerceString(args.to ?? "").trim();
  if (!from || !to) return toolError("from and to are required (ISO8601)");

  const ctx = await storeContext(args);
  if (typeof ctx === "string") return ctx;

  let kinds: CalendarRangeKind[] | undefined;
  if (Array.isArray(args.kinds)) {
    kinds = args.kinds.filter(
      (k): k is CalendarRangeKind =>
        k === "event" || k === "task" || k === "project" || k === "holiday",
    );
  }

  let sources: BuiltinCalendarSourceId[] | undefined;
  if (Array.isArray(args.sources)) {
    sources = args.sources.filter(
      (s): s is BuiltinCalendarSourceId =>
        s === "cn_holiday" || s === "traditional" || s === "international" || s === "solar_term",
    );
  }

  try {
    const items = await listCalendarRange(ctx, omitUndefined({ from, to, kinds, sources }));
    return toolResult({ ok: true, action: "range", items });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

async function handleConvertToTask(args: Record<string, unknown>): Promise<string> {
  const id = Number(args.id);
  if (!Number.isFinite(id) || id <= 0) return toolError("id is required");
  const ctx = await storeContext(args, "write");
  if (typeof ctx === "string") return ctx;
  try {
    const item = await convertCalendarEventToTaskItem(ctx, id);
    return toolResult({
      ok: true,
      action: "convert_to_task",
      item: {
        id: item.id,
        title: item.title,
        due_at: item.due_at,
        list_id: item.list_id,
        status: item.status,
      },
    });
  } catch (e) {
    return toolError(String(e instanceof Error ? e.message : e));
  }
}

export function buildCalendarToolDefs() {
  return [
    {
      name: "calendar_list",
      description: "List calendar events, optionally filtered by range_start/range_end.",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          range_start: { type: "string", description: "ISO8601 range start" },
          range_end: { type: "string", description: "ISO8601 range end" },
          limit: { type: "integer" },
        },
      },
      handler: handleList,
    },
    {
      name: "calendar_create",
      description: "Create a calendar event.",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          title: { type: "string" },
          content: { type: "string" },
          start_at: { type: "string", description: "ISO8601 start" },
          end_at: { type: "string", description: "ISO8601 end or null" },
          all_day: { type: "boolean" },
          remind_at: { type: "string", description: "ISO8601 remind time" },
        },
        required: ["title", "start_at"],
      },
      handler: handleCreate,
    },
    {
      name: "calendar_update",
      description: "Update a calendar event by id.",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          id: { type: "integer" },
          title: { type: "string" },
          content: { type: "string" },
          start_at: { type: "string" },
          end_at: { type: "string" },
          all_day: { type: "boolean" },
          remind_at: { type: "string" },
        },
        required: ["id"],
      },
      handler: handleUpdate,
    },
    {
      name: "calendar_delete",
      description: "Delete a calendar event by id.",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          id: { type: "integer" },
        },
        required: ["id"],
      },
      handler: handleDelete,
    },
    {
      name: "calendar_get",
      description: "Get a calendar event by id.",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          id: { type: "integer" },
        },
        required: ["id"],
      },
      handler: handleGet,
    },
    {
      name: "calendar_convert_to_task",
      description:
        "Retype a calendar event into a task_item in the default Inbox (same entity id; lossy: drops all_day).",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          id: { type: "integer" },
        },
        required: ["id"],
      },
      handler: handleConvertToTask,
    },
    {
      name: "calendar_range",
      description:
        "Unified calendar range: events, pending tasks with planned time, projects, and builtin holiday calendars overlapping [from, to].",
      parameters: {
        type: "object",
        properties: {
          ...WORLD_ID_OPTIONAL,
          from: { type: "string", description: "ISO8601 range start" },
          to: { type: "string", description: "ISO8601 range end" },
          kinds: {
            type: "array",
            items: { type: "string", enum: ["event", "task", "project", "holiday"] },
          },
          sources: {
            type: "array",
            description: "Builtin holiday sources when kinds includes holiday",
            items: {
              type: "string",
              enum: ["cn_holiday", "traditional", "international", "solar_term"],
            },
          },
        },
        required: ["from", "to"],
      },
      handler: handleRange,
    },
  ];
}
