import { getSubjectKind } from "@freeanima/client/portal-sdk";
import { loadIdMap, resolveIdFields } from "@freeanima/client/portal-sdk/offline-id-map";
import {
  registerOfflineModule,
  registerOfflineModuleCap,
} from "@freeanima/client/portal-sdk/offline-module-registry";
import type {
  FlushOpOutcome,
  RpcModuleAdapter,
} from "@freeanima/client/portal-sdk/offline-module-types";
import {
  enqueueOutboxOp,
  listOutboxOps,
  removeOutboxOp,
  resolveOutboxScope,
  type OfflineOutboxOp,
} from "@freeanima/client/portal-sdk/offline-outbox";
import {
  flushOfflineModule,
  recordFlushIdMapping,
} from "@freeanima/client/portal-sdk/offline-sync";
import {
  allocateTempId,
  isTempId,
  seedTempIdAllocatorFromIdMap,
} from "@freeanima/client/portal-sdk/offline-temp-id";
import { preferOnlineWrite } from "@freeanima/client/portal-sdk/prefer-online-write";
import { formatCstIso } from "@freeanima/shared/util";
import { omitUndefined } from "@freeanima/shared/util";
import { getTypedHabitatClient } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import { randomUuid } from "@freeanima/shared/rpc-contract";
import { readOfflineCache, writeOfflineCache } from "@freeanima/client/portal-sdk/offline-cache";

import type { CalendarEventRow, SubjectKind } from "./api.ts";

const MODULE_ID = "calendar";
const NAMESPACE = "calendar";
const EVENTS_CACHE_ID = "events";

function habitat() {
  return getTypedHabitatClient();
}

function scheduleFlush(scope: string): void {
  void flushOfflineModule(MODULE_ID, scope).catch(() => {});
}

async function ensureAllocatorSeeded(scope: string): Promise<void> {
  await seedTempIdAllocatorFromIdMap(scope, MODULE_ID);
}

async function readLocalEvents(scope: string): Promise<CalendarEventRow[]> {
  return (await readOfflineCache<CalendarEventRow[]>(scope, NAMESPACE, EVENTS_CACHE_ID)) ?? [];
}

async function writeLocalEvents(scope: string, items: CalendarEventRow[]): Promise<void> {
  await writeOfflineCache(scope, NAMESPACE, EVENTS_CACHE_ID, items);
}

async function upsertLocalEvent(scope: string, item: CalendarEventRow): Promise<void> {
  const items = await readLocalEvents(scope);
  const next = items.filter((row) => row.id !== item.id);
  next.push(item);
  await writeLocalEvents(scope, next);
}

async function removeLocalEvent(scope: string, id: number): Promise<void> {
  const items = await readLocalEvents(scope);
  await writeLocalEvents(
    scope,
    items.filter((row) => row.id !== id),
  );
}

export async function reconcileServerCalendarEvents(items: CalendarEventRow[]): Promise<void> {
  const scope = resolveOutboxScope();
  const ops = await listOutboxOps(scope, MODULE_ID);
  const pendingTemp = new Set(
    ops
      .filter((op) => op.method === "calendar.create" && typeof op.tempEntityId === "number")
      .map((op) => op.tempEntityId as number),
  );
  const locals = await readLocalEvents(scope);
  const keptTemps = locals.filter((row) => isTempId(row.id) && pendingTemp.has(row.id));
  await writeLocalEvents(scope, [...items, ...keptTemps]);
}

async function flushCalendarOp(op: OfflineOutboxOp, scope: string): Promise<FlushOpOutcome> {
  try {
    const idMap = await loadIdMap(scope, MODULE_ID);
    const payload = resolveIdFields(op.payload, idMap, ["id"]);
    if (op.method === "calendar.create") {
      const data = await habitat().call("calendar.create", payload as never);
      if (typeof op.tempEntityId === "number") {
        await recordFlushIdMapping(scope, MODULE_ID, op.tempEntityId, data.item.id);
        await removeLocalEvent(scope, op.tempEntityId);
        await upsertLocalEvent(scope, data.item);
      }
      return { status: "done" };
    }
    if (op.method === "calendar.patch") {
      const data = await habitat().call("calendar.patch", payload as never);
      await upsertLocalEvent(scope, data.item);
      return { status: "done" };
    }
    if (op.method === "calendar.delete") {
      await habitat().call("calendar.delete", payload as never);
      const id = Number((payload as { id?: number }).id);
      if (Number.isFinite(id)) await removeLocalEvent(scope, id);
      return { status: "done" };
    }
    return { status: "failed", error: `unknown method ${op.method}` };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

function compactCalendarOutbox(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
  const byTemp = new Map<number, OfflineOutboxOp[]>();
  const rest: OfflineOutboxOp[] = [];
  for (const op of ops) {
    if (typeof op.tempEntityId === "number") {
      const list = byTemp.get(op.tempEntityId) ?? [];
      list.push(op);
      byTemp.set(op.tempEntityId, list);
    } else {
      rest.push(op);
    }
  }
  const compacted: OfflineOutboxOp[] = [];
  for (const group of byTemp.values()) {
    const create = group.find((op) => op.method === "calendar.create");
    const del = group.find((op) => op.method === "calendar.delete");
    if (create && del) continue;
    if (create) {
      const patches = group.filter((op) => op.method === "calendar.patch");
      let payload = { ...create.payload };
      for (const patch of patches) {
        payload = { ...payload, ...patch.payload, subject_kind: create.payload.subject_kind };
        delete (payload as { id?: number }).id;
      }
      compacted.push({ ...create, payload });
      continue;
    }
    compacted.push(...group);
  }
  return [...compacted, ...rest];
}

export const calendarRpcAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: MODULE_ID,
  ordering: "fifo",
  compactOutbox: compactCalendarOutbox,
  resolvePayloadIds: (payload, idMap) => resolveIdFields(payload, idMap, ["id"]),
  flushOp: async (op, ctx) => flushCalendarOp(op, ctx.scope),
  refreshAll: async (_scope) => {
    for (const subject_kind of ["user", "agent"] as const) {
      try {
        const data = await habitat().call("calendar.list", { subject_kind, limit: 200 });
        if (subject_kind === getSubjectKind()) {
          await reconcileServerCalendarEvents(data.items);
        }
      } catch {
        /* offline */
      }
    }
  },
};

export function registerCalendarOfflineModule(): void {
  registerOfflineModule(calendarRpcAdapter);
  registerOfflineModuleCap(MODULE_ID, { offlineWritable: true });
}

export async function offlineCreateCalendarEvent(
  subjectKind: SubjectKind,
  input: {
    title: string;
    content?: string;
    start_at: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
    client_op_id?: string;
  },
): Promise<CalendarEventRow> {
  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);
  const clientOpId = input.client_op_id ?? randomUuid();

  return preferOnlineWrite(
    async () => {
      const data = await habitat().call(
        "calendar.create",
        omitUndefined({
          subject_kind: subjectKind,
          title: input.title,
          content: input.content,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          remind_at: input.remind_at,
          client_op_id: clientOpId,
        }),
      );
      await upsertLocalEvent(scope, data.item);
      return data.item;
    },
    async () => {
      const tempId = allocateTempId(scope, MODULE_ID);
      const now = formatCstIso();
      const item: CalendarEventRow = {
        id: tempId,
        title: input.title,
        content: input.content ?? "",
        start_at: input.start_at,
        end_at: input.end_at ?? null,
        all_day: input.all_day ?? false,
        remind_at: input.remind_at ?? null,
        tag_ids: [],
        created_at: now,
        updated_at: now,
      };
      await upsertLocalEvent(scope, item);
      await enqueueOutboxOp(scope, {
        id: clientOpId,
        moduleId: MODULE_ID,
        method: "calendar.create",
        payload: omitUndefined({
          subject_kind: subjectKind,
          title: input.title,
          content: input.content,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          remind_at: input.remind_at,
          client_op_id: clientOpId,
        }),
        tempEntityId: tempId,
        createdAt: now,
      });
      scheduleFlush(scope);
      return item;
    },
  );
}

export async function offlineUpdateCalendarEvent(
  subjectKind: SubjectKind,
  input: {
    id: number;
    title?: string;
    content?: string;
    start_at?: string;
    end_at?: string | null;
    all_day?: boolean;
    remind_at?: string | null;
  },
): Promise<CalendarEventRow> {
  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);

  return preferOnlineWrite(
    async () => {
      const data = await habitat().call(
        "calendar.patch",
        omitUndefined({
          subject_kind: subjectKind,
          id: input.id,
          title: input.title,
          content: input.content,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          remind_at: input.remind_at,
        }),
      );
      await upsertLocalEvent(scope, data.item);
      return data.item;
    },
    async () => {
      const locals = await readLocalEvents(scope);
      const existing = locals.find((row) => row.id === input.id);
      if (!existing) throw new Error("calendar event not found offline");
      const item: CalendarEventRow = {
        ...existing,
        title: input.title ?? existing.title,
        content: input.content ?? existing.content,
        start_at: input.start_at ?? existing.start_at,
        end_at: input.end_at === undefined ? existing.end_at : input.end_at,
        all_day: input.all_day ?? existing.all_day,
        remind_at: input.remind_at === undefined ? existing.remind_at : input.remind_at,
        updated_at: formatCstIso(),
      };
      await upsertLocalEvent(scope, item);
      const opId = randomUuid();
      await enqueueOutboxOp(scope, {
        id: opId,
        moduleId: MODULE_ID,
        method: "calendar.patch",
        payload: omitUndefined({
          subject_kind: subjectKind,
          id: input.id,
          title: input.title,
          content: input.content,
          start_at: input.start_at,
          end_at: input.end_at,
          all_day: input.all_day,
          remind_at: input.remind_at,
          client_op_id: opId,
        }),
        ...(isTempId(input.id) ? { tempEntityId: input.id } : {}),
        createdAt: formatCstIso(),
      });
      scheduleFlush(scope);
      return item;
    },
  );
}

export async function offlineDeleteCalendarEvent(
  subjectKind: SubjectKind,
  id: number,
): Promise<void> {
  const scope = resolveOutboxScope();
  await ensureAllocatorSeeded(scope);

  await preferOnlineWrite(
    async () => {
      await habitat().call("calendar.delete", { subject_kind: subjectKind, id });
      await removeLocalEvent(scope, id);
    },
    async () => {
      await removeLocalEvent(scope, id);
      if (isTempId(id)) {
        const ops = await listOutboxOps(scope, MODULE_ID);
        for (const op of ops) {
          if (op.tempEntityId === id) await removeOutboxOp(scope, op.id);
        }
        return;
      }
      const opId = randomUuid();
      await enqueueOutboxOp(scope, {
        id: opId,
        moduleId: MODULE_ID,
        method: "calendar.delete",
        payload: { subject_kind: subjectKind, id, client_op_id: opId },
        createdAt: formatCstIso(),
      });
      scheduleFlush(scope);
    },
  );
}
