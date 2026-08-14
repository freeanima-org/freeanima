/**
 * 执行滴答 CSV 导入（Habitat RPC）。
 */

import { ensureTagsByTitles } from "@freeanima/features/tag/domain";
import { searchEntities } from "@freeanima/habitat/core/db/pg/entity";
import {
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
  asTaskItem,
  asTaskList,
} from "@freeanima/habitat/core/db/schema/entity";
import { omitUndefined } from "@freeanima/habitat/core/util";

import {
  parseDidaCsv,
  planDidaImport,
  type DidaImportMode,
  type DidaImportPlanEntry,
} from "@freeanima/shared/task/dida-csv-import.ts";
import { completeTaskItem, createTaskItem, getTaskItem, updateTaskItem } from "./item-store.ts";
import { createTaskList, updateTaskList } from "./list-store.ts";

export type DidaImportApplyResult = {
  created_lists: number;
  updated_lists: number;
  created_tasks: number;
  updated_tasks: number;
  skipped: number;
  abandoned_skipped: number;
  warnings: string[];
  errors: string[];
};

async function indexDidaClientOps(
  worldId: number,
  opIds: string[],
  component: typeof TASK_LIST_COMPONENT | typeof TASK_ITEM_COMPONENT,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  for (const opId of opIds) {
    const result = await searchEntities({
      world_id: worldId,
      primary_component: component,
      filters: { client_op_id: opId },
      limit: 1,
      mode: "filter_only",
    });
    const row = result.results[0];
    if (!row) continue;
    if (component === TASK_LIST_COMPONENT && asTaskList(row)) {
      map.set(opId, row.id);
    }
    if (component === TASK_ITEM_COMPONENT && asTaskItem(row)) {
      map.set(opId, row.id);
    }
  }
  return map;
}

export async function applyDidaCsvImport(
  worldId: number,
  csvText: string,
  mode: DidaImportMode = "upsert",
): Promise<DidaImportApplyResult> {
  const parsed = parseDidaCsv(csvText);
  if (!parsed.ok) {
    return {
      created_lists: 0,
      updated_lists: 0,
      created_tasks: 0,
      updated_tasks: 0,
      skipped: 0,
      abandoned_skipped: 0,
      warnings: [],
      errors: [parsed.error],
    };
  }

  const listOps = parsed.lists.map((l) => l.client_op_id);
  const taskOps = parsed.tasks.map((t) => t.client_op_id);
  const existingLists = await indexDidaClientOps(worldId, listOps, TASK_LIST_COMPONENT);
  const existingTasks = await indexDidaClientOps(worldId, taskOps, TASK_ITEM_COMPONENT);
  const existing = new Map([...existingLists, ...existingTasks]);
  const plan = planDidaImport(parsed, existing, mode);

  const idByOp = new Map(existing);
  let created_lists = 0;
  let updated_lists = 0;
  let created_tasks = 0;
  let updated_tasks = 0;
  let skipped = 0;
  const errors: string[] = [];
  const warnings = [...parsed.warnings];

  for (const entry of plan) {
    if (entry.kind !== "folder" && entry.kind !== "list") continue;
    if (entry.action === "skip") {
      skipped += 1;
      if (entry.local_id != null) idByOp.set(entry.mapped.client_op_id, entry.local_id);
      continue;
    }
    try {
      const parentId =
        entry.mapped.parent_folder_op_id != null
          ? (idByOp.get(entry.mapped.parent_folder_op_id) ?? null)
          : null;
      if (entry.action === "create") {
        const row = await createTaskList(
          worldId,
          omitUndefined({
            name: entry.mapped.name,
            is_folder: entry.mapped.is_folder,
            parent_id: parentId,
            client_op_id: entry.mapped.client_op_id,
          }),
        );
        idByOp.set(entry.mapped.client_op_id, row.id);
        created_lists += 1;
      } else if (entry.local_id != null) {
        await updateTaskList(
          worldId,
          omitUndefined({
            id: entry.local_id,
            name: entry.mapped.name,
            parent_id: entry.mapped.is_folder ? undefined : parentId,
          }),
        );
        idByOp.set(entry.mapped.client_op_id, entry.local_id);
        updated_lists += 1;
      }
    } catch (e) {
      errors.push(`${entry.mapped.client_op_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const taskEntries = plan.filter(
    (e): e is Extract<DidaImportPlanEntry, { kind: "task" }> => e.kind === "task",
  );
  const roots = taskEntries.filter((e) => !e.mapped.parent_task_op_id);
  const children = taskEntries.filter((e) => e.mapped.parent_task_op_id);

  for (const entry of [...roots, ...children]) {
    if (entry.action === "skip") {
      skipped += 1;
      if (entry.local_id != null) idByOp.set(entry.mapped.client_op_id, entry.local_id);
      continue;
    }
    try {
      const listId = idByOp.get(entry.mapped.list_client_op_id);
      if (listId == null) {
        errors.push(`${entry.mapped.client_op_id}: 清单未就绪`);
        continue;
      }
      const tagIds = await ensureTagsByTitles(worldId, entry.mapped.tags);
      const parentId =
        entry.mapped.parent_task_op_id != null
          ? (idByOp.get(entry.mapped.parent_task_op_id) ?? null)
          : null;

      let itemId: number;
      if (entry.action === "create") {
        const row = await createTaskItem(
          worldId,
          omitUndefined({
            title: entry.mapped.title,
            content: entry.mapped.content,
            list_id: listId,
            priority: entry.mapped.priority,
            start_at: entry.mapped.start_at,
            due_at: entry.mapped.due_at,
            reminders: entry.mapped.reminders.length > 0 ? entry.mapped.reminders : undefined,
            recurrence: entry.mapped.recurrence,
            parent_id: parentId,
            sort_order: entry.mapped.sort_order,
            tag_ids: tagIds.length > 0 ? tagIds : undefined,
            client_op_id: entry.mapped.client_op_id,
          }),
        );
        itemId = row.id;
        created_tasks += 1;
      } else {
        if (entry.local_id == null) {
          errors.push(`${entry.mapped.client_op_id}: 缺少 local_id`);
          continue;
        }
        const row = await updateTaskItem(
          worldId,
          omitUndefined({
            id: entry.local_id,
            title: entry.mapped.title,
            content: entry.mapped.content,
            priority: entry.mapped.priority,
            start_at: entry.mapped.start_at,
            due_at: entry.mapped.due_at,
            reminders: entry.mapped.reminders,
            recurrence: entry.mapped.recurrence,
            parent_id: parentId,
            sort_order: entry.mapped.sort_order,
            tag_ids: tagIds,
          }),
        );
        if (!row) {
          errors.push(`${entry.mapped.client_op_id}: 更新失败`);
          continue;
        }
        itemId = row.id;
        updated_tasks += 1;
      }
      idByOp.set(entry.mapped.client_op_id, itemId);

      if (entry.mapped.status === "completed") {
        const cur = await getTaskItem(worldId, itemId);
        if (cur && cur.status !== "completed") {
          await completeTaskItem(worldId, itemId);
        }
      }

      for (const w of entry.mapped.warnings) {
        warnings.push(`${entry.mapped.client_op_id}: ${w}`);
      }
    } catch (e) {
      errors.push(`${entry.mapped.client_op_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    created_lists,
    updated_lists,
    created_tasks,
    updated_tasks,
    skipped,
    abandoned_skipped: parsed.skipped_abandoned,
    warnings: [...new Set(warnings)],
    errors,
  };
}
