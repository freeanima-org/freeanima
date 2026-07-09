import { Button } from "@freeanima/frontend/ui-kit";
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
  onCancel: () => void;
  onStartPomodoro?: (item: TaskItemRow) => void;
  saveStatus?: DetailSaveStatus;
};

export function TaskDetailPanel({
  item,
  onChange,
  onCancel,
  onStartPomodoro,
  saveStatus = "idle",
}: TaskDetailPanelProps) {
  return (
    <DetailPanelShell onClose={onCancel} closeLabel="取消" saveStatus={saveStatus}>
      <TaskDetailEditor
        item={item}
        onChange={onChange}
        legend="详情"
        titleExtra={
          item.project_id != null ? (
            <p className="text-muted-foreground mt-1 text-xs">归属：{taskAttributionLabel(item)}</p>
          ) : null
        }
      >
        <TaskPomodoroFocusSection taskId={item.id} />
        {item.status === "pending" && onStartPomodoro ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => onStartPomodoro(item)}
            >
              开始番茄钟
            </Button>
          </div>
        ) : null}
      </TaskDetailEditor>
    </DetailPanelShell>
  );
}
