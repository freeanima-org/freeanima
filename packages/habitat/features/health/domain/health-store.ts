import {
  HEALTH_RECORD_COMPONENT,
  asHealthRecord,
  healthRecordBodySchema,
  type HealthRecordBody,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { createObjectFile } from "@freeanima/features/object-storage/domain";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/habitat/core/db/pg/entity";

import {
  buildSummary,
  collectMetricSeries,
  flagExamItems,
  type MetricSeriesPoint,
} from "./health-helpers.ts";
import type {
  HealthCreateInput,
  HealthListOpts,
  HealthMetricsSeriesOpts,
  HealthRow,
  HealthSearchOpts,
  HealthUpdateInput,
} from "./types.ts";

function toHealthRow(row: NonNullable<ReturnType<typeof asHealthRecord>>): HealthRow {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    record_kind: row.record_kind,
    recorded_at: row.recorded_at,
    profile_key: row.profile_key,
    readings: row.readings ?? [],
    exam_items: row.exam_items ?? [],
    medication_source: row.medication_source ?? null,
    dosage: row.dosage ?? null,
    frequency: row.frequency ?? null,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    related_task_id: row.related_task_id ?? null,
    visit_type: row.visit_type ?? null,
    facility: row.facility ?? null,
    doctor_name: row.doctor_name ?? null,
    follow_up_at: row.follow_up_at ?? null,
    file_entity_ids: row.file_entity_ids ?? [],
    deleted_at: row.deleted_at ? row.deleted_at.toISOString() : null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function sortByRecordedAt(rows: HealthRow[]): HealthRow[] {
  return rows.toSorted((a, b) => b.recorded_at.localeCompare(a.recorded_at) || b.id - a.id);
}

function assertHealthInWorld(
  existing: Awaited<ReturnType<typeof getEntity>>,
  worldId: number,
): existing is NonNullable<typeof existing> {
  if (!existing || existing.primary_component !== HEALTH_RECORD_COMPONENT) return false;
  return existing.world_id === worldId;
}

function normalizeBody(
  input: HealthCreateInput | HealthUpdateInput,
  existing?: HealthRecordBody,
): HealthRecordBody {
  const recordKind = input.record_kind ?? existing?.record_kind;
  if (!recordKind) throw new Error("record_kind is required");

  const examItems =
    input.exam_items != null
      ? flagExamItems(input.exam_items)
      : existing?.exam_items
        ? flagExamItems(existing.exam_items)
        : undefined;

  const body: HealthRecordBody = {
    record_kind: recordKind,
    recorded_at: input.recorded_at ?? existing?.recorded_at ?? new Date().toISOString(),
    profile_key: input.profile_key ?? existing?.profile_key ?? "self",
    readings: input.readings ?? existing?.readings,
    exam_items: examItems,
    medication_source: input.medication_source ?? existing?.medication_source,
    dosage: input.dosage ?? existing?.dosage,
    frequency: input.frequency ?? existing?.frequency,
    start_at: input.start_at ?? existing?.start_at,
    end_at: input.end_at ?? existing?.end_at,
    related_task_id:
      input.related_task_id !== undefined
        ? input.related_task_id
        : (existing?.related_task_id ?? null),
    visit_type: input.visit_type ?? existing?.visit_type,
    facility: input.facility ?? existing?.facility,
    doctor_name: input.doctor_name ?? existing?.doctor_name,
    follow_up_at: input.follow_up_at ?? existing?.follow_up_at,
    file_entity_ids: input.file_entity_ids ?? existing?.file_entity_ids ?? [],
    client_op_id:
      input.client_op_id !== undefined ? input.client_op_id : (existing?.client_op_id ?? null),
  };

  return body;
}

export async function listHealthRecords(
  worldId: number,
  opts: HealthListOpts = {},
): Promise<HealthRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.record_kind) filters.record_kind = opts.record_kind;
  if (opts.profile_key) filters.profile_key = opts.profile_key;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: HEALTH_RECORD_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  const rows = result.results
    .map((row) => {
      const parsed = asHealthRecord(row);
      return parsed ? toHealthRow(parsed) : null;
    })
    .filter((r): r is HealthRow => r != null);

  return sortByRecordedAt(rows);
}

export async function getHealthRecord(worldId: number, id: number): Promise<HealthRow | null> {
  const row = await getEntity(id);
  if (!assertHealthInWorld(row, worldId)) return null;
  const parsed = asHealthRecord(row);
  return parsed ? toHealthRow(parsed) : null;
}

export async function searchHealthRecords(
  worldId: number,
  opts: HealthSearchOpts,
): Promise<{ items: HealthRow[]; count: number }> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: HEALTH_RECORD_COMPONENT,
    query: opts.query,
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    mode: "hybrid",
    include_count: true,
  });

  const items = result.results
    .map((row) => {
      const parsed = asHealthRecord(row);
      return parsed ? toHealthRow(parsed) : null;
    })
    .filter((r): r is HealthRow => r != null);

  return { items, count: result.count ?? items.length };
}

export async function createHealthRecord(
  worldId: number,
  input: HealthCreateInput,
): Promise<HealthRow> {
  const body = normalizeBody(input);
  const title = input.title.trim();
  if (!title) throw new Error("title is required");
  const summary = buildSummary(body, title);

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [HEALTH_RECORD_COMPONENT],
    primary_component: HEALTH_RECORD_COMPONENT,
    title,
    summary,
    content: input.content?.trim() ?? "",
    body,
  });

  const parsed = asHealthRecord(row);
  if (!parsed) throw new Error("health_record create failed");
  return toHealthRow(parsed);
}

export async function updateHealthRecord(
  worldId: number,
  input: HealthUpdateInput,
): Promise<HealthRow | null> {
  const existing = await getEntity(input.id);
  if (!assertHealthInWorld(existing, worldId)) return null;

  const current = asHealthRecord(existing);
  if (!current) return null;

  const body = normalizeBody(input, current);
  const title = input.title?.trim() ?? current.title;
  const summary = buildSummary(body, title);

  const row = await updateEntity({
    id: input.id,
    ...omitUndefined({
      title: input.title != null ? title : undefined,
      summary,
      content: input.content,
      body,
    }),
  });
  if (!row) return null;

  const parsed = asHealthRecord(row);
  return parsed ? toHealthRow(parsed) : null;
}

export async function deleteHealthRecord(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!assertHealthInWorld(existing, worldId)) return false;
  await deleteEntity(id);
  return true;
}

export async function queryHealthMetricSeries(
  worldId: number,
  opts: HealthMetricsSeriesOpts,
): Promise<MetricSeriesPoint[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: HEALTH_RECORD_COMPONENT,
    ...(opts.profile_key ? { filters: { profile_key: opts.profile_key } } : {}),
    limit: 2000,
    offset: 0,
    mode: "filter_only",
    include_count: false,
  });

  const bodies = result.results.flatMap((row) => {
    const parsed = healthRecordBodySchema.safeParse(row.body);
    if (!parsed.success) return [];
    return [{ id: row.id, body: parsed.data }];
  });

  return collectMetricSeries(
    bodies,
    opts.metric_key,
    omitUndefined({
      since: opts.since,
      until: opts.until,
      limit: opts.limit,
    }),
  );
}

export async function attachHealthFiles(
  worldId: number,
  recordId: number,
  files: Array<{ title: string; bytes: Uint8Array; mime_type?: string }>,
): Promise<HealthRow | null> {
  const existing = await getEntity(recordId);
  if (!assertHealthInWorld(existing, worldId)) return null;
  const current = asHealthRecord(existing);
  if (!current) return null;

  const newIds: number[] = [];
  for (const file of files) {
    const objectFile = await createObjectFile({
      world_id: worldId,
      title: file.title,
      bytes: file.bytes,
      ...(file.mime_type ? { mime_type: file.mime_type } : {}),
    });
    newIds.push(objectFile.id);
  }

  const file_entity_ids = [...(current.file_entity_ids ?? []), ...newIds];
  return updateHealthRecord(worldId, { id: recordId, file_entity_ids });
}
