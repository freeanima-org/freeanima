import {
  DetailPanelShell,
  TaskDetailEditor,
  type DetailSaveStatus,
  type TaskDetailFocusField,
} from "@freeanima/ui-kit/composite";
import type { TaskItemRowPayload } from "@freeanima/shared/rpc-contract/frames/task.ts";
import { TASK_ITEM_COMPONENT } from "@freeanima/shared/entity-shapes";
import { TagPicker, type TagKnown } from "@freeanima/features/tag/ui/spa/components/TagPicker.tsx";

import { taskAttributionLabel } from "../lib/task-attribution.ts";
import { TaskPomodoroFocusSection } from "./TaskPomodoroFocusSection.tsx";
import { TaskSubtaskSection } from "./TaskSubtaskSection.tsx";
import { EntityIdLabel } from "./EntityIdLabel.tsx";

export type { DetailSaveStatus };
export type TaskTagKnown = TagKnown;
export type { TaskDetailFocusField };

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
  onTagKnown?: (tag: TaskTagKnown) => void;
  /** compact peek：标题/描述激活进入全屏编辑 */
  onTextFieldActivate?: (field: TaskDetailFocusField) => void;
  /** compact immersive：挂载后聚焦字段 */
  focusField?: TaskDetailFocusField;
};

/** 任务详情 SSOT：清单、项目、entity overlay 共用 */
export function TaskDetailPanel<T extends TaskItemRowPayload>({
  item,
  onChange,
  saveStatus = "idle",
  showAttribution = true,
  showPomodoroFocus = true,
  onTagKnown,
  onTextFieldActivate,
  focusField,
}: TaskDetailPanelProps<T>) {
  return (
    <DetailPanelShell saveStatus={saveStatus}>
      <TaskDetailEditor
        item={item}
        onChange={onChange}
        {...(onTextFieldActivate ? { onTextFieldActivate } : {})}
        {...(focusField ? { focusField } : {})}
        titleExtra={
          <div className="mt-1 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <EntityIdLabel id={item.id} animaComponent="task_item" />
              {showAttribution && item.project_id != null ? (
                <p className="text-muted-foreground text-xs">归属：{taskAttributionLabel(item)}</p>
              ) : null}
            </div>
            <TagPicker
              primaryComponent={TASK_ITEM_COMPONENT}
              tagIds={item.tag_ids}
              onChange={(tag_ids) => onChange({ ...item, tag_ids })}
              mode="multi"
              {...(onTagKnown ? { onTagKnown } : {})}
            />
          </div>
        }
      >
        <TaskSubtaskSection parent={item} />
        {showPomodoroFocus ? <TaskPomodoroFocusSection taskId={item.id} /> : null}
      </TaskDetailEditor>
    </DetailPanelShell>
  );
}
