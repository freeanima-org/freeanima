import {
  DetailPanelShell,
  TaskDetailEditor,
  type DetailSaveStatus,
} from "@freeanima/frontend/ui-kit/composite";

import type { TaskItemRow } from "../lib/api.ts";
import { taskAttributionLabel } from "../lib/task-attribution.ts";
import { TaskPomodoroFocusSection } from "./TaskPomodoroFocusSection.tsx";

export type { DetailSaveStatus };

type TaskDetailPanelProps = {
  item: TaskItemRow;
  onChange: (item: TaskItemRow) => void;
  saveStatus?: DetailSaveStatus;
};

export function TaskDetailPanel({ item, onChange, saveStatus = "idle" }: TaskDetailPanelProps) {
  return (
    <DetailPanelShell saveStatus={saveStatus}>
      <TaskDetailEditor
        item={item}
        onChange={onChange}
        titleExtra={
          item.project_id != null ? (
            <p className="text-muted-foreground mt-1 text-xs">归属：{taskAttributionLabel(item)}</p>
          ) : null
        }
      >
        <TaskPomodoroFocusSection taskId={item.id} />
      </TaskDetailEditor>
    </DetailPanelShell>
  );
}
