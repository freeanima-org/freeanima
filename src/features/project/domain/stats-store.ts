import { PROJECT_COMPONENT, asProject } from "@freeanima/host/core/db/schema/entity";
import {
  countPendingTaskItemsGroupedByProjectId,
  listEntities,
} from "@freeanima/host/core/db/pg/entity";

import type { ProjectListOpts } from "./types.ts";

export type ProjectTaskCountRow = {
  id: number;
  task_count: number;
};

/** 项目 pending 任务数（次要数据；不经 project.list） */
export async function listProjectTaskStats(
  worldId: number,
  opts: ProjectListOpts = {},
): Promise<ProjectTaskCountRow[]> {
  const rows = await listEntities({
    world_id: worldId,
    primary_component: PROJECT_COMPONENT,
    limit: 500,
  });
  const counts = await countPendingTaskItemsGroupedByProjectId(worldId);
  const result: ProjectTaskCountRow[] = [];
  for (const row of rows) {
    const parsed = asProject(row);
    if (!parsed) continue;
    if (opts.folder_id !== undefined && (parsed.folder_id ?? null) !== opts.folder_id) continue;
    if (opts.status != null && parsed.status !== opts.status) continue;
    result.push({
      id: parsed.id,
      task_count: counts.get(parsed.id) ?? 0,
    });
  }
  return result;
}
