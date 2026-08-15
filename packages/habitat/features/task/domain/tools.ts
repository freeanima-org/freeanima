import type { ToolSetRegistry } from "@freeanima/habitat/core/tool";

import { buildCalendarToolDefs } from "@freeanima/features/calendar/domain/calendar-tools.ts";
import { buildProjectToolDefs } from "@freeanima/features/project/domain/project-tools.ts";
import { buildTaskItemToolDefs } from "./task-item-tools.ts";
import { buildTaskListToolDefs } from "./tasklist-tools.ts";

/** Tasks, lists, projects, and calendar — unified planning surface. */
export function registerTaskTools(toolSets: ToolSetRegistry): void {
  toolSets.registerToolSet(
    "agenda",
    "Tasks, lists, projects, and calendar (events + unified range)",
    [
      ...buildTaskItemToolDefs(),
      ...buildTaskListToolDefs(),
      ...buildProjectToolDefs(),
      ...buildCalendarToolDefs(),
    ],
  );
}

/** 供测试重置 */
export function resetTaskToolsForTests(): void {}
