import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  listCalendarEvents,
  listCalendarRange,
  resolveCalendarWorldId,
  updateCalendarEvent,
  type CalendarRangeKind,
  type CalendarSubjectKind,
} from "../domain/index.ts";

import { isPostgresPrimary } from "@freeanima/host/core/db/pg";
import { omitUndefined } from "@freeanima/host/core/util";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

async function storeContext(_deps: RuntimeDeps, subjectKind: CalendarSubjectKind) {
  const worldId = await resolveCalendarWorldId(subjectKind);
  return { worldId };
}

export async function serviceCalendarList(
  deps: RuntimeDeps,
  input: {
    subject_kind: CalendarSubjectKind;
    range_start?: string;
    range_end?: string;
    limit?: number;
    offset?: number;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await listCalendarEvents(
    ctx,
    omitUndefined({
      range_start: input.range_start,
      range_end: input.range_end,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceCalendarCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: CalendarSubjectKind;
    title: string;
    content?: string;
    start_at: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
    tag_ids?: number[];
    client_op_id?: string;
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await createCalendarEvent(ctx, input);
  return { item };
}

export async function serviceCalendarPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: CalendarSubjectKind;
    id: number;
    title?: string;
    content?: string;
    start_at?: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
    tag_ids?: number[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const { id, subject_kind: _kind, ...patch } = input;
  const item = await updateCalendarEvent(ctx, { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceCalendarDelete(
  deps: RuntimeDeps,
  input: { subject_kind: CalendarSubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const ok = await deleteCalendarEvent(ctx, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceCalendarGet(
  deps: RuntimeDeps,
  input: { subject_kind: CalendarSubjectKind; id: number },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const item = await getCalendarEvent(ctx, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceCalendarRange(
  deps: RuntimeDeps,
  input: {
    subject_kind: CalendarSubjectKind;
    from: string;
    to: string;
    kinds?: CalendarRangeKind[];
  },
) {
  assertPg(deps);
  const ctx = await storeContext(deps, input.subject_kind);
  const items = await listCalendarRange(
    ctx,
    omitUndefined({
      from: input.from,
      to: input.to,
      kinds: input.kinds,
    }),
  );
  return { items };
}
