import {
  DetailPanelShell,
  TaskDetailEditor,
  type DetailSaveStatus,
} from "@freeanima/frontend/ui-kit/composite";
import type { TaskItemRowPayload } from "@freeanima/shared/sap-contract/frames/task.ts";

import { taskAttributionLabel } from "../lib/task-attribution.ts";
import { TaskPomodoroFocusSection } from "./TaskPomodoroFocusSection.tsx";
import { TaskTagPicker } from "./TaskTagPicker.tsx";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

export type { DetailSaveStatus };

export type TaskDetailPanelProps<T extends TaskItemRowPayload = TaskItemRowPayload> = {
  item: T;
  onChange: (item: T) => void;
  saveStatus?: DetailSaveStatus;
  /**
   * 清单/搜索等显示「归属：项目/清单」。
   * 项目模块内任务已在项目上下文中，默认应关闭。
   */
  showAttribution?: boolean;
  /** 番茄专注记录（实体级，清单与项目均可展示） */
  showPomodoroFocus?: boolean;
};

/** 任务详情 SSOT：清单、项目、entity overlay 共用 */
export function TaskDetailPanel<T extends TaskItemRowPayload>({
  item,
  onChange,
  saveStatus = "idle",
  showAttribution = true,
  showPomodoroFocus = true,
}: TaskDetailPanelProps<T>) {
  return (
    <DetailPanelShell saveStatus={saveStatus}>
      <TaskDetailEditor
        item={item}
        onChange={onChange}
        titleExtra={
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <EntityIdLabel id={item.id} animaComponent="task_item" />
              {showAttribution && item.project_id != null ? (
                <p className="text-muted-foreground text-xs">归属：{taskAttributionLabel(item)}</p>
              ) : null}
            </div>
            <TaskTagPicker
              tagIds={item.tag_ids}
              onChange={(tag_ids) => onChange({ ...item, tag_ids })}
            />
          </div>
        }
      >
        {showPomodoroFocus ? <TaskPomodoroFocusSection taskId={item.id} /> : null}
      </TaskDetailEditor>
    </DetailPanelShell>
  );
}
