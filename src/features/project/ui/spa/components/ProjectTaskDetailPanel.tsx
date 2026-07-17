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
  saveStatus?: DetailSaveStatus;
};

export function ProjectTaskDetailPanel({
  item,
  onChange,
  saveStatus = "idle",
}: ProjectTaskDetailPanelProps) {
  return (
    <DetailPanelShell saveStatus={saveStatus}>
      <TaskDetailEditor item={item} onChange={onChange} />
    </DetailPanelShell>
  );
}
