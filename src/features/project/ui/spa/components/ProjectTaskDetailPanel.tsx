import {
  DetailPanelShell,
  TaskDetailEditor,
  type DetailSaveStatus,
} from "@freeanima/frontend/ui-kit/composite";

import type { TaskItemRow } from "../lib/api.ts";

export type { DetailSaveStatus };

type ProjectTaskDetailPanelProps = {
  item: TaskItemRow;
  onChange: (item: TaskItemRow) => void;
  onCancel: () => void;
  saveStatus?: DetailSaveStatus;
};

export function ProjectTaskDetailPanel({
  item,
  onChange,
  onCancel,
  saveStatus = "idle",
}: ProjectTaskDetailPanelProps) {
  return (
    <DetailPanelShell onClose={onCancel} saveStatus={saveStatus}>
      <TaskDetailEditor item={item} onChange={onChange} legend="任务详情" />
    </DetailPanelShell>
  );
}
