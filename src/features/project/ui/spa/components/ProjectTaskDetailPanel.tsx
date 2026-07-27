import {
  TaskDetailPanel,
  type DetailSaveStatus,
  type TaskDetailPanelProps,
} from "@freeanima/features/task/ui/spa/components/TaskDetailPanel.tsx";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";

export type { DetailSaveStatus };

type ProjectTaskDetailPanelProps<T extends TaskItemRowPayload = TaskItemRowPayload> = Pick<
  TaskDetailPanelProps<T>,
  "item" | "onChange" | "saveStatus" | "onTagKnown" | "onTextFieldActivate"
>;

/** 项目任务详情：复用清单侧 TaskDetailPanel，关闭冗余归属行 */
export function ProjectTaskDetailPanel<T extends TaskItemRowPayload>({
  item,
  onChange,
  saveStatus = "idle",
  onTagKnown,
  onTextFieldActivate,
}: ProjectTaskDetailPanelProps<T>) {
  return (
    <TaskDetailPanel
      item={item}
      onChange={onChange}
      saveStatus={saveStatus}
      showAttribution={false}
      showPomodoroFocus
      {...(onTagKnown ? { onTagKnown } : {})}
      {...(onTextFieldActivate ? { onTextFieldActivate } : {})}
    />
  );
}
