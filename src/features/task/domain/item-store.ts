import {
  TASK_ITEM_COMPONENT,
  TAG_COMPONENT,
  asTaskItem,
  asProject,
  PROJECT_COMPONENT,
  TASK_LIST_COMPONENT,
  computeNextOccurrence,
  normalizeRecurrenceInput,
  normalizeSchedulableReminders,
  shiftSchedulableReminders,
  type EntityRow,
  type TaskRecurrence,
} from "@freeanima/host/core/db/schema/entity";
import { assertEntityInWorld, assertSameWorldReferent } from "@freeanima/host/core/db/pg/entity";
import { formatCstIso, omitUndefined } from "@freeanima/host/core/util";
import {
  createEntity,
  deleteEntity,
  getEntity,
  searchEntities,
  updateEntity,
} from "@freeanima/host/core/db/pg/entity";
import { rescheduleTaskReminderScheduler } from "@freeanima/host/platform/boot/task-reminder-scheduler.ts";

import { assertListAcceptsTasks, assertTaskListNotArchived } from "./list-store.ts";
import { createTaskOccurrence, deleteOccurrencesForSeries } from "./occurrence-store.ts";
import { nextPrependSortOrder } from "./sort-order.ts";
import type {
  TaskItemCreateInput,
  TaskItemListOpts,
  TaskItemRow,
  TaskItemSearchOpts,
  TaskItemUpdateInput,
} from "./types.ts";

async function assertProjectActiveForTask(projectId: number, worldId: number): Promise<void> {
  const row = await getEntity(projectId);
  if (!row || row.primary_component !== PROJECT_COMPONENT) {
    throw new Error("project not found");
  }
  await assertEntityInWorld(projectId, worldId);
  const parsed = asProject(row);
  if (!parsed) throw new Error("project not found");
  if (parsed.status === "on_hold") {
    throw new Error("project is on hold");
  }
}

function normalizeTagIds(tagIds: number[] | undefined): number[] {
  if (!tagIds?.length) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of tagIds) {
    const id = Math.floor(Number(raw));
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function assertTagIdsInWorld(worldId: number, tagIds: number[]): Promise<void> {
  for (const id of tagIds) {
    const row = await getEntity(id);
    if (!row || row.primary_component !== TAG_COMPONENT) {
      throw new Error(`tag not found: ${id}`);
    }
    await assertEntityInWorld(id, worldId);
  }
}

function toItemRow(entity: EntityRow): TaskItemRow {
  const row = asTaskItem(entity);
  if (!row) throw new Error("invalid task_item row");
  const reminders = normalizeSchedulableReminders({
    remind_at: row.remind_at,
    reminders: row.reminders,
  });
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tag_ids: [...(entity.tag_ids ?? [])],
    status: row.status,
    priority: row.priority,
    due_at: row.due_at ?? null,
    remind_at: reminders.remind_at,
    ...(reminders.reminders.length > 0 ? { reminders: reminders.reminders } : {}),
    list_id: row.list_id ?? null,
    project_id: row.project_id ?? null,
    sort_order: row.sort_order ?? 0,
    completed_at: row.completed_at ?? null,
    recurrence: row.recurrence ?? null,
    parent_id: row.parent_id ?? null,
    created_at: entity.created_at.toISOString(),
    updated_at: entity.updated_at.toISOString(),
  };
}

function touchReminderScheduler(): void {
  try {
    rescheduleTaskReminderScheduler();
  } catch {
    /* scheduler 可能尚未 start（单测） */
  }
}

/** 按 id 取单条任务（含项目内）；不存在或不在 world 返回 null */
export async function getTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  const row = await getEntity(id);
  if (!row || row.primary_component !== TASK_ITEM_COMPONENT) return null;
  if (row.world_id !== worldId) return null;
  try {
    return toItemRow(row);
  } catch {
    return null;
  }
}

export async function listTaskItems(
  worldId: number,
  opts: TaskItemListOpts = {},
): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = opts.filters != null ? { ...opts.filters } : {};

  if (opts.filters == null) {
    if (opts.list_id != null) filters.list_id = opts.list_id;
    if (opts.status != null) filters.status = opts.status;
    if (opts.due_today) filters.due_today = true;
    if (opts.tag_ids?.length) filters.tag_ids = opts.tag_ids;
    if (opts.project_id != null) filters.project_id = opts.project_id;
    else if (opts.in_backlog !== false) filters.in_backlog = true;
    if (opts.parent_id != null) filters.parent_id = opts.parent_id;
    else if (opts.roots_only !== false) filters.roots_only = true;
  } else {
    if (opts.filters.project_id == null && opts.filters.in_backlog !== false) {
      filters.in_backlog = true;
    }
    if (opts.parent_id != null) filters.parent_id = opts.parent_id;
    else if (opts.roots_only !== false && opts.filters.parent_id == null) {
      filters.roots_only = opts.filters.roots_only ?? true;
    }
  }

  const topLevelTagIds =
    opts.tag_ids ?? (opts.filters?.tag_ids?.length ? opts.filters.tag_ids : undefined);

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    ...(topLevelTagIds?.length ? { tag_ids: topLevelTagIds } : {}),
    limit: opts.limit ?? 500,
    offset: opts.offset ?? 0,
    mode: "filter_only",
    include_count: false,
  });

  return result.results
    .map((row) => {
      try {
        return toItemRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskItemRow => row != null)
    .toSorted((a, b) => a.sort_order - b.sort_order || a.id - b.id);
}

async function findTaskItemByClientOpId(
  worldId: number,
  clientOpId: string,
): Promise<TaskItemRow | null> {
  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    filters: { client_op_id: clientOpId },
    limit: 1,
    mode: "filter_only",
    include_count: false,
  });
  const row = result.results[0];
  if (!row) return null;
  try {
    return toItemRow(row);
  } catch {
    return null;
  }
}

export async function createTaskItem(
  worldId: number,
  input: TaskItemCreateInput,
): Promise<TaskItemRow> {
  if (input.client_op_id) {
    const existing = await findTaskItemByClientOpId(worldId, input.client_op_id);
    if (existing) return existing;
  }

  const hasList = input.list_id != null;
  const hasProject = input.project_id != null;
  if (hasList === hasProject) {
    throw new Error("exactly one of list_id or project_id required");
  }

  if (input.list_id != null) {
    await assertListAcceptsTasks(input.list_id, worldId);
  }
  if (input.project_id != null) {
    await assertProjectActiveForTask(input.project_id, worldId);
  }
  const tagIds = normalizeTagIds(input.tag_ids);
  await assertTagIdsInWorld(worldId, tagIds);
  const listId = hasProject ? null : (input.list_id as number);
  const projectId = hasProject ? (input.project_id as number) : null;

  // 未显式传 sort_order：min(pending)-STEP（允许负值），只写新行；拖拽有空隙时也只改一项。
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const siblings = await listTaskItems(worldId, {
      ...(listId != null ? { list_id: listId } : {}),
      ...(projectId != null ? { project_id: projectId } : {}),
      status: "pending",
    });
    sortOrder = nextPrependSortOrder(siblings.map((s) => s.sort_order));
  }

  const dueAt = input.due_at ?? null;
  let recurrence: TaskRecurrence | null = null;
  if (input.recurrence != null) {
    recurrence = normalizeRecurrenceInput(input.recurrence, dueAt ?? formatCstIso(new Date()));
  }

  if (input.parent_id != null) {
    await assertValidParentTask(worldId, input.parent_id, {
      listId,
      projectId,
      forbidNested: true,
    });
    if (recurrence != null) {
      throw new Error("subtasks cannot have recurrence");
    }
  }

  const reminders = normalizeSchedulableReminders({
    remind_at: input.remind_at,
    reminders: input.reminders,
  });

  const body = {
    status: "pending" as const,
    priority: input.priority ?? "none",
    list_id: listId,
    sort_order: sortOrder,
    due_at: dueAt,
    remind_at: reminders.remind_at,
    reminders: reminders.reminders,
    completed_at: null,
    client_op_id: input.client_op_id ?? null,
    project_id: projectId,
    parent_id: input.parent_id ?? null,
    recurrence,
  };

  const row = await createEntity({
    type: "content",
    world_id: worldId,
    components: [TASK_ITEM_COMPONENT],
    primary_component: TASK_ITEM_COMPONENT,
    title: input.title.trim(),
    content: input.content?.trim() ?? "",
    body,
    tag_ids: tagIds,
  });

  if (!asTaskItem(row)) throw new Error("task item create failed");
  touchReminderScheduler();
  return toItemRow(row);
}

async function assertValidParentTask(
  worldId: number,
  parentId: number,
  opts: { listId: number | null; projectId: number | null; forbidNested: boolean },
): Promise<void> {
  const parentRow = await getEntity(parentId);
  if (!parentRow || parentRow.primary_component !== TASK_ITEM_COMPONENT) {
    throw new Error("parent task not found");
  }
  await assertEntityInWorld(parentId, worldId);
  const parent = asTaskItem(parentRow);
  if (!parent) throw new Error("parent task not found");
  if (opts.forbidNested && parent.parent_id != null) {
    throw new Error("subtasks cannot nest");
  }
  const parentList = parent.list_id ?? null;
  const parentProject = parent.project_id ?? null;
  if (opts.listId !== parentList || opts.projectId !== parentProject) {
    throw new Error("subtask must share list/project with parent");
  }
}

export async function updateTaskItem(
  worldId: number,
  input: TaskItemUpdateInput,
): Promise<TaskItemRow | null> {
  // status→completed 统一走 complete 语义（含重复滚动）
  if (input.status === "completed") {
    const { status: _status, only_this: _onlyThis, ...rest } = input;
    if (
      rest.title !== undefined ||
      rest.content !== undefined ||
      rest.tag_ids !== undefined ||
      rest.list_id !== undefined ||
      rest.project_id !== undefined ||
      rest.priority !== undefined ||
      rest.due_at !== undefined ||
      rest.remind_at !== undefined ||
      rest.sort_order !== undefined ||
      rest.recurrence !== undefined
    ) {
      await updateTaskItem(worldId, { ...rest, id: input.id });
    }
    return completeTaskItem(worldId, input.id);
  }

  const existing = await getEntity(input.id);
  if (!existing) return null;
  await assertEntityInWorld(input.id, worldId);

  const parsedExisting = asTaskItem(existing);
  if (!parsedExisting) return null;

  if (input.list_id != null && input.project_id != null) {
    throw new Error("list_id and project_id are mutually exclusive");
  }

  const inProject = parsedExisting.project_id != null;
  if (!inProject && parsedExisting.list_id != null) {
    await assertTaskListNotArchived(parsedExisting.list_id, worldId);
  }

  const bodyPatch: Record<string, unknown> = {};
  if (input.list_id !== undefined) {
    if (input.list_id == null) {
      throw new Error("list_id cannot be cleared without project_id");
    }
    await assertListAcceptsTasks(input.list_id, worldId);
    await assertSameWorldReferent(input.id, input.list_id);
    bodyPatch.list_id = input.list_id;
    bodyPatch.project_id = null;
  }
  if (input.project_id !== undefined) {
    if (input.project_id != null) {
      await assertProjectActiveForTask(input.project_id, worldId);
      await assertSameWorldReferent(input.id, input.project_id);
      bodyPatch.project_id = input.project_id;
      bodyPatch.list_id = null;
    } else if (input.list_id === undefined) {
      throw new Error("list_id required when leaving project");
    } else {
      bodyPatch.project_id = null;
    }
  }
  if (input.priority !== undefined) bodyPatch.priority = input.priority;
  if (input.due_at !== undefined) {
    bodyPatch.due_at = input.due_at;
    const existingRec = parsedExisting.recurrence ?? null;
    if (existingRec && input.due_at != null && input.only_this !== true) {
      bodyPatch.recurrence = { ...existingRec, schedule_at: input.due_at };
    }
  }
  if (input.remind_at !== undefined || input.reminders !== undefined) {
    const synced = normalizeSchedulableReminders({
      remind_at: input.remind_at !== undefined ? input.remind_at : parsedExisting.remind_at,
      reminders: input.reminders !== undefined ? input.reminders : parsedExisting.reminders,
    });
    bodyPatch.remind_at = synced.remind_at;
    bodyPatch.reminders = synced.reminders;
  }
  if (input.parent_id !== undefined) {
    if (input.parent_id != null) {
      if (input.parent_id === input.id) throw new Error("task cannot be its own parent");
      const nextList =
        input.list_id !== undefined
          ? input.list_id
          : ((bodyPatch.list_id as number | null | undefined) ?? parsedExisting.list_id ?? null);
      const nextProject =
        input.project_id !== undefined
          ? input.project_id
          : ((bodyPatch.project_id as number | null | undefined) ??
            parsedExisting.project_id ??
            null);
      await assertValidParentTask(worldId, input.parent_id, {
        listId: nextList,
        projectId: nextProject,
        forbidNested: true,
      });
      if (parsedExisting.parent_id == null) {
        // 根变子：禁止已有子任务的根挂到别的父下（一层模型）
        const kids = await listTaskItems(worldId, {
          parent_id: input.id,
          roots_only: false,
          in_backlog: false,
          ...(parsedExisting.project_id != null
            ? { project_id: parsedExisting.project_id }
            : parsedExisting.list_id != null
              ? { list_id: parsedExisting.list_id }
              : {}),
        });
        if (kids.length > 0) throw new Error("task with subtasks cannot become a subtask");
      }
      bodyPatch.parent_id = input.parent_id;
      bodyPatch.recurrence = null;
    } else {
      bodyPatch.parent_id = null;
    }
  }
  if (input.sort_order !== undefined) bodyPatch.sort_order = input.sort_order;
  if (input.status !== undefined) {
    // status=completed 已在入口委托 completeTaskItem；此处仅 pending
    bodyPatch.status = input.status;
    bodyPatch.completed_at = null;
  }
  if (input.recurrence !== undefined) {
    if (input.recurrence == null) {
      bodyPatch.recurrence = null;
    } else {
      const dueForSchedule =
        input.due_at !== undefined
          ? input.due_at
          : ((bodyPatch.due_at as string | null | undefined) ?? parsedExisting.due_at ?? null);
      bodyPatch.recurrence = normalizeRecurrenceInput(input.recurrence, dueForSchedule);
    }
  }

  let nextTagIds: number[] | undefined;
  if (input.tag_ids !== undefined) {
    nextTagIds = normalizeTagIds(input.tag_ids);
    await assertTagIdsInWorld(worldId, nextTagIds);
  }

  const row = await updateEntity(
    omitUndefined({
      id: input.id,
      title: input.title,
      content: input.content,
      body: Object.keys(bodyPatch).length > 0 ? bodyPatch : undefined,
      tag_ids: nextTagIds,
    }),
  );
  if (!row) return null;

  if (
    input.due_at !== undefined ||
    input.remind_at !== undefined ||
    input.reminders !== undefined ||
    input.status !== undefined ||
    input.recurrence !== undefined
  ) {
    touchReminderScheduler();
  }

  try {
    return toItemRow(row);
  } catch {
    return null;
  }
}

async function rollOrFinishRecurring(
  worldId: number,
  id: number,
  parsed: NonNullable<ReturnType<typeof asTaskItem>>,
  opts: { writeOccurrence: boolean; finishForever: boolean },
): Promise<TaskItemRow | null> {
  const now = formatCstIso(new Date());
  const recurrence = parsed.recurrence;

  if (opts.writeOccurrence && recurrence) {
    await createTaskOccurrence(worldId, {
      series_task_id: id,
      title: parsed.title,
      content: parsed.content,
      completed_at: now,
      due_at: parsed.due_at ?? null,
      list_id: parsed.list_id ?? null,
      project_id: parsed.project_id ?? null,
    });
  }

  if (!recurrence || opts.finishForever) {
    const row = await updateEntity({
      id,
      body: {
        status: "completed",
        completed_at: now,
        recurrence: null,
        last_notified_at: null,
      },
    });
    return row ? toItemRow(row) : null;
  }

  const next = computeNextOccurrence(recurrence, {
    completedAt: now,
    currentDueAt: parsed.due_at ?? null,
    decrementCount: opts.writeOccurrence,
  });

  if (!next) {
    const row = await updateEntity({
      id,
      body: {
        status: "completed",
        completed_at: now,
        recurrence: null,
        last_notified_at: null,
      },
    });
    return row ? toItemRow(row) : null;
  }

  const nextReminders = shiftSchedulableReminders(
    parsed.due_at,
    next.due_at,
    parsed.reminders,
    parsed.remind_at,
  );
  const row = await updateEntity({
    id,
    body: {
      status: "pending",
      completed_at: null,
      due_at: next.due_at,
      remind_at: nextReminders.remind_at,
      reminders: nextReminders.reminders,
      recurrence: next.recurrence,
      last_notified_at: null,
    },
  });
  touchReminderScheduler();
  return row ? toItemRow(row) : null;
}

export async function completeTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  const existing = await getEntity(id);
  if (!existing) return null;
  await assertEntityInWorld(id, worldId);
  const parsed = asTaskItem(existing);
  if (!parsed) return null;

  if (!parsed.recurrence) {
    return updateTaskItemFields(worldId, id, {
      status: "completed",
      completed_at: formatCstIso(new Date()),
    });
  }

  return rollOrFinishRecurring(worldId, id, parsed, {
    writeOccurrence: true,
    finishForever: false,
  });
}

/** 跳过本期：推进 due/schedule，不写 occurrence */
export async function skipTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  const existing = await getEntity(id);
  if (!existing) return null;
  await assertEntityInWorld(id, worldId);
  const parsed = asTaskItem(existing);
  if (!parsed?.recurrence) {
    throw new Error("task has no recurrence");
  }
  return rollOrFinishRecurring(worldId, id, parsed, {
    writeOccurrence: false,
    finishForever: false,
  });
}

/** 永久完成：写一条 occurrence，清 recurrence，标 completed */
export async function completeTaskItemForever(
  worldId: number,
  id: number,
): Promise<TaskItemRow | null> {
  const existing = await getEntity(id);
  if (!existing) return null;
  await assertEntityInWorld(id, worldId);
  const parsed = asTaskItem(existing);
  if (!parsed) return null;
  return rollOrFinishRecurring(worldId, id, parsed, {
    writeOccurrence: parsed.recurrence != null,
    finishForever: true,
  });
}

async function updateTaskItemFields(
  worldId: number,
  id: number,
  bodyPatch: Record<string, unknown>,
): Promise<TaskItemRow | null> {
  await assertEntityInWorld(id, worldId);
  const row = await updateEntity({ id, body: bodyPatch });
  if (!row) return null;
  try {
    return toItemRow(row);
  } catch {
    return null;
  }
}

export async function uncompleteTaskItem(worldId: number, id: number): Promise<TaskItemRow | null> {
  return updateTaskItemFields(worldId, id, { status: "pending", completed_at: null });
}

export async function deleteTaskItem(worldId: number, id: number): Promise<boolean> {
  const existing = await getEntity(id);
  if (!existing) return false;
  await assertEntityInWorld(id, worldId);
  const parsed = asTaskItem(existing);
  if (parsed && parsed.project_id == null && parsed.list_id != null) {
    await assertTaskListNotArchived(parsed.list_id, worldId);
  }
  if (parsed) {
    await deleteOccurrencesForSeries(worldId, id);
    // 级联软删子任务
    const children = await listTaskItems(worldId, {
      parent_id: id,
      roots_only: false,
      in_backlog: false,
      ...(parsed.project_id != null
        ? { project_id: parsed.project_id }
        : parsed.list_id != null
          ? { list_id: parsed.list_id }
          : {}),
    });
    for (const child of children) {
      await deleteEntity(child.id);
    }
  }
  touchReminderScheduler();
  return deleteEntity(id);
}

/** 子任务进度（根任务） */
export async function countSubtasks(
  worldId: number,
  parentId: number,
): Promise<{ done: number; total: number }> {
  const kids = await listTaskItems(worldId, {
    parent_id: parentId,
    roots_only: false,
    status: "all",
    in_backlog: false,
  });
  const done = kids.filter((k) => k.status === "completed").length;
  return { done, total: kids.length };
}

async function resolveEntityTitle(
  id: number,
  primary: string,
  cache: Map<number, string>,
): Promise<string | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const row = await getEntity(id);
  if (!row || row.primary_component !== primary) return null;
  const title = row.title.trim() || `#${id}`;
  cache.set(id, title);
  return title;
}

export async function enrichTaskItemsWithAttribution(rows: TaskItemRow[]): Promise<TaskItemRow[]> {
  if (rows.length === 0) return rows;
  const projectCache = new Map<number, string>();
  const listCache = new Map<number, string>();
  const enriched: TaskItemRow[] = [];
  for (const row of rows) {
    const project_title =
      row.project_id != null
        ? await resolveEntityTitle(row.project_id, PROJECT_COMPONENT, projectCache)
        : null;
    const list_name =
      row.list_id != null
        ? await resolveEntityTitle(row.list_id, TASK_LIST_COMPONENT, listCache)
        : null;
    enriched.push({
      ...row,
      project_title,
      list_name,
    });
  }
  return enriched;
}

export async function searchTaskItems(
  worldId: number,
  opts: TaskItemSearchOpts,
): Promise<TaskItemRow[]> {
  const filters: Record<string, unknown> = {};
  if (opts.list_id != null) filters.list_id = opts.list_id;
  if (opts.project_id != null) filters.project_id = opts.project_id;
  if (opts.status != null && opts.status !== "all") filters.status = opts.status;

  const result = await searchEntities({
    world_id: worldId,
    primary_component: TASK_ITEM_COMPONENT,
    query: opts.query,
    ...(Object.keys(filters).length > 0 ? { filters } : {}),
    limit: Math.max(1, Math.min(50, opts.limit ?? 30)),
    mode: "hybrid",
    include_count: false,
  });

  const rows = result.results
    .map((row) => {
      try {
        return toItemRow(row);
      } catch {
        return null;
      }
    })
    .filter((row): row is TaskItemRow => row != null);
  return enrichTaskItemsWithAttribution(rows);
}
