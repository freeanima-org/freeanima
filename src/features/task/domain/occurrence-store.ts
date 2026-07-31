import {
  TASK_OCCURRENCE_COMPONENT,
  asTaskOccurrence,
  type EntityRow,
} from "@freeanima/host/core/db/schema/entity";
import { assertEntityInWorld } from "@freeanima/host/core/db/pg/entity";
import { formatCstIso } from "@freeanima/host/core/util";
import { createEntity, deleteEntity, searchEntities } from "@freeanima/host/core/db/pg/entity";

export type TaskOccurrenceRow = {
  id: number;
  title: string;
  content: string;
  series_task_id: number;
  completed_at: string;
  due_at: string | null;
  list_id: number | null;
  project_id: number | null;
  created_at: string;
  updated_at: string;
};

export type TaskOccurrenceCreateInput = {
  series_task_id: number;
  title: string;
  content?: string;
  completed_at?: string;
  due_at?: string | null;
  list_id?: number | null;
  project_id?: number | null;
  client_op_id?: string | null;
};

function toOccurrenceRow(entity: EntityRow): TaskOccurrenceRow {
  const row = asTaskOccurrence(entity);
  if (!row) throw new Error("invalid task_occurrence row");
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    series_task_id: row.series_task_id,
    completed_at: row.completed_at,
    due_at: row.due_at ?? null,
    list_id: row.list_id ?? null,
    project_id: row.project_id ?? null,
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
  };
}

export async function createTaskOccurrence(
  worldId: number,
  input: TaskOccurrenceCreateInput,
): Promise<TaskOccurrenceRow> {
  const body = {
    series_task_id: input.series_task_id,
    completed_at: input.completed_at ?? formatCstIso(new Date()),
    due_at: input.due_at ?? null,
    list_id: input.list_id ?? null,
    project_id: input.project_id ?? null,
    client_op_id: input.client_op_id ?? null,
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TASK_OCCURRENCE_COMPONENT],
    primary_component: TASK_OCCURRENCE_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
    body,
  });

  if (!asTaskOccurrence(row)) throw new Error("task occurrence create failed");
  return toOccurrenceRow(row);
}

export async function listTaskOccurrences(
  worldId: number,
  seriesTaskId: number,
  opts: { limit?: number; offset?: number } = {},
): Promise<TaskOccurrenceRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_OCCURRENCE_COMPONENT,
    filters: { series_task_id: seriesTaskId },
    limit: opts.limit ?? 100,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => {
      try {
        return toOccurrenceRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskOccurrenceRow => row != null)
    .toSorted((a, b) => {
      const cmp = b.completed_at.localeCompare(a.completed_at);
      return cmp !== 0 ? cmp : b.id - a.id;
    });
}

export async function listTaskOccurrencesByFilters(
  worldId: number,
  filters: Record<string, unknown>,
  opts: { limit?: number; offset?: number } = {},
): Promise<TaskOccurrenceRow[]> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_OCCURRENCE_COMPONENT,
    filters,
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => {
      try {
        return toOccurrenceRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskOccurrenceRow => row != null);
}

/** 软删某 live 系列下全部 occurrence */
export async function deleteOccurrencesForSeries(
  worldId: number,
  seriesTaskId: number,
): Promise<number> {
  const rows = await listTaskOccurrences(worldId, seriesTaskId, { limit: 5000 });
  let deleted = 0;
  for (const row of rows) {
    await assertEntityInWorld(row.id, worldId);
    if (await deleteEntity(row.id)) deleted += 1;
  }
  return deleted;
}
