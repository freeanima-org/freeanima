import {
  DetailPanelShell,
  TaskDetailEditor,
  type DetailSaveStatus,
} from "@freeanima/frontend/ui-kit/composite";

import type { TaskItemRow } from "../lib/api.ts";
import { taskAttributionLabel } from "../lib/task-attribution.ts";
import { TaskPomodoroFocusSection } from "./TaskPomodoroFocusSection.tsx";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <EntityIdLabel id={item.id} animaComponent="task_item" />
            {item.project_id != null ? (
              <p className="text-muted-foreground text-xs">归属：{taskAttributionLabel(item)}</p>
            ) : null}
          </div>
        }
      >
        <TaskPomodoroFocusSection taskId={item.id} />
      </TaskDetailEditor>
    </DetailPanelShell>
  );
}
