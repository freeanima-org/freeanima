import {
  CALENDAR_EVENT_COMPONENT,
  asCalendarEvent,
  normalizeSchedulableReminders,
  type CalendarEventBody,
  type CalendarEventSearchFilters,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import type {
  CalendarEventCreateInput,
  CalendarEventListOpts,
  CalendarEventRow,
  CalendarEventUpdateInput,
  CalendarReminderEntry,
  CalendarStoreContext,
} from "./types.ts";

function toCalendarReminders(
  reminders: ReadonlyArray<{ at: string } & Record<string, unknown>>,
): CalendarReminderEntry[] {
  return reminders.map((r) => {
    const entry: CalendarReminderEntry = { at: r.at };
    const anchor = r.anchor;
    if (anchor === "start" || anchor === "end" || anchor === "due") {
      entry.anchor = anchor;
    }
    if ("last_notified_at" in r) {
      const last = r.last_notified_at;
      entry.last_notified_at = last === null || typeof last === "string" ? last : null;
    }
    return entry;
  });
}

function toEventRow(
  row: NonNullable<ReturnType<typeof asCalendarEvent>>,
  meta: { created_at: Date; updated_at: Date; tag_ids?: number[] },
): CalendarEventRow {
  const reminders = normalizeSchedulableReminders({
    remind_at: row.remind_at,
    reminders: row.reminders,
    defaultAnchor: "start",
  });
  const base: CalendarEventRow = {
    id: row.id,
    title: row.title,
    content: row.content,
    start_at: row.start_at,
    end_at: row.end_at ?? null,
    all_day: row.all_day ?? false,
    remind_at: reminders.remind_at,
    tag_ids: [...(meta.tag_ids ?? [])],
    created_at: meta.created_at.toISOString(),
    updated_at: meta.updated_at.toISOString(),
  };
  if (reminders.reminders.length > 0) {
    return { ...base, reminders: toCalendarReminders(reminders.reminders) };
  }
  return base;
}

function sortByStartAtAsc(a: CalendarEventRow, b: CalendarEventRow): number {
  const at = Date.parse(a.start_at);
  const bt = Date.parse(b.start_at);
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
  return a.id - b.id;
}

function assertEventInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  ctx: CalendarStoreContext,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== CALENDAR_EVENT_COMPONENT) return false;
  return existing.world_id === ctx.worldId;
}

async function findByClientOpId(
  ctx: CalendarStoreContext,
  clientOpId: string,
): Promise<CalendarEventRow | null> {
  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: CALENDAR_EVENT_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
  });
  const row = result.results[0];
  if (!row) return null;
  const parsed = asCalendarEvent(row);
  if (!parsed) return null;
  return toEventRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    tag_ids: row.tag_ids,
  });
}

export async function listCalendarEvents(
  ctx: CalendarStoreContext,
  opts: CalendarEventListOpts = {},
): Promise<CalendarEventRow[]> {
  const filters: CalendarEventSearchFilters = {};
  if (opts.range_start) filters.range_start = opts.range_start;
  if (opts.range_end) filters.range_end = opts.range_end;

  const result = await searchEntities({
    world_id: ctx.worldId,
    primary_component: CALENDAR_EVENT_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 200,
    offset: opts.offset ?? 0,
    mode: "filter_only",
  });

  const items: CalendarEventRow[] = [];
  for (const row of result.results) {
    const parsed = asCalendarEvent(row);
    if (!parsed) continue;
    items.push(
      toEventRow(parsed, {
        created_at: row.created_at,
        updated_at: row.updated_at,
        tag_ids: row.tag_ids,
      }),
    );
  }
  return items.toSorted(sortByStartAtAsc);
}

export async function getCalendarEvent(
  ctx: CalendarStoreContext,
  id: number,
): Promise<CalendarEventRow | null> {
  const row = await getEntity(id);
  if (!assertEventInWorld(row, ctx)) return null;
  const parsed = asCalendarEvent(row);
  if (!parsed) return null;
  return toEventRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    tag_ids: row.tag_ids,
  });
}

export async function createCalendarEvent(
  ctx: CalendarStoreContext,
  input: CalendarEventCreateInput,
): Promise<CalendarEventRow> {
  if (input.client_op_id) {
    const existing = await findByClientOpId(ctx, input.client_op_id);
    if (existing) return existing;
  }

  const startAt = input.start_at.trim();
  if (!startAt) throw new Error("start_at is required");

  const reminders = normalizeSchedulableReminders({
    remind_at: input.remind_at === undefined ? null : input.remind_at,
    reminders: input.reminders,
    defaultAnchor: "start",
  });

  const body: CalendarEventBody = {
    start_at: startAt,
    end_at: input.end_at === undefined ? null : input.end_at,
    all_day: input.all_day ?? false,
    remind_at: reminders.remind_at,
    reminders: reminders.reminders,
    last_notified_at: null,
  };

  const row = await createEntity({
    type: "content",
    world_id: ctx.worldId,
    components: [CALENDAR_EVENT_COMPONENT],
    primary_component: CALENDAR_EVENT_COMPONENT,
    title: input.title.trim(),
    summary: "",
    content: input.content?.trim() ?? "",
    tag_ids: input.tag_ids ?? [],
    body,
    client_op_id: input.client_op_id ?? null,
  });

  const parsed = asCalendarEvent(row);
  if (!parsed) throw new Error("calendar event create failed");
  return toEventRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    tag_ids: row.tag_ids,
  });
}

export async function updateCalendarEvent(
  ctx: CalendarStoreContext,
  input: CalendarEventUpdateInput,
): Promise<CalendarEventRow | null> {
  const existing = await getEntity(input.id);
  if (!assertEventInWorld(existing, ctx)) return null;
  const parsedExisting = asCalendarEvent(existing);
  if (!parsedExisting) return null;

  const bodyPatch: Record<string, unknown> = {};
  if (input.start_at !== undefined) bodyPatch.start_at = input.start_at.trim();
  if (input.end_at !== undefined) bodyPatch.end_at = input.end_at;
  if (input.all_day !== undefined) bodyPatch.all_day = input.all_day;
  if (input.remind_at !== undefined || input.reminders !== undefined) {
    const synced = normalizeSchedulableReminders({
      remind_at:
        input.remind_at !== undefined ? input.remind_at : (parsedExisting.remind_at ?? null),
      reminders:
        input.reminders !== undefined ? input.reminders : (parsedExisting.reminders ?? undefined),
      defaultAnchor: "start",
    });
    bodyPatch.remind_at = synced.remind_at;
    bodyPatch.reminders = synced.reminders;
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title?.trim(),
      content: input.content?.trim(),
      tag_ids: input.tag_ids,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
    }),
  );
  if (!row) return null;
  const parsed = asCalendarEvent(row);
  if (!parsed) return null;
  return toEventRow(parsed, {
    created_at: row.created_at,
    updated_at: row.updated_at,
    tag_ids: row.tag_ids,
  });
}

export async function deleteCalendarEvent(ctx: CalendarStoreContext, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertEventInWorld(existing, ctx)) return false;
  await deleteEntity(id);
  return true;
}
