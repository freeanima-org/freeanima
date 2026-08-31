import type { ActionSheetItem } from "@freeanima/ui-kit/composite";

import type { CalendarRangeItem } from "./api.ts";

export type AgendaMenuHandlers = {
  onEditEvent: (item: Extract<CalendarRangeItem, { kind: "event" }>) => void;
  onStartPomodoroEvent: (item: Extract<CalendarRangeItem, { kind: "event" }>) => void;
  onConvertEventToTask: (item: Extract<CalendarRangeItem, { kind: "event" }>) => void;
  onDeleteEvent: (item: Extract<CalendarRangeItem, { kind: "event" }>) => void;
  onEditTask: (item: Extract<CalendarRangeItem, { kind: "task" }>) => void;
  onStartPomodoroTask: (item: Extract<CalendarRangeItem, { kind: "task" }>) => void;
  onToggleCompleteTask: (item: Extract<CalendarRangeItem, { kind: "task" }>) => void;
  onConvertTaskToEvent: (item: Extract<CalendarRangeItem, { kind: "task" }>) => void;
  onDeleteTask: (item: Extract<CalendarRangeItem, { kind: "task" }>) => void;
  onOpenProject: (item: Extract<CalendarRangeItem, { kind: "project" }>) => void;
};

function taskHasPlannedTime(item: Extract<CalendarRangeItem, { kind: "task" }>): boolean {
  return Boolean(item.start_at || item.end_at || item.due_at);
}

/** 按议程条目 kind 产出溢出菜单；节日返回空列表。 */
export function buildAgendaMenuItems(
  item: CalendarRangeItem,
  handlers: AgendaMenuHandlers,
): ActionSheetItem[] {
  if (item.kind === "holiday") return [];

  if (item.kind === "project") {
    return [{ label: "打开", onClick: () => handlers.onOpenProject(item) }];
  }

  if (item.kind === "event") {
    return [
      { label: "编辑", onClick: () => handlers.onEditEvent(item) },
      { label: "开始番茄", onClick: () => handlers.onStartPomodoroEvent(item) },
      { label: "转为任务", onClick: () => handlers.onConvertEventToTask(item) },
      { label: "删除", danger: true, onClick: () => handlers.onDeleteEvent(item) },
    ];
  }

  const items: ActionSheetItem[] = [{ label: "编辑", onClick: () => handlers.onEditTask(item) }];
  if (item.status === "pending") {
    items.push({ label: "开始番茄", onClick: () => handlers.onStartPomodoroTask(item) });
  }
  items.push({
    label: item.status === "completed" ? "标记未完成" : "标记完成",
    onClick: () => handlers.onToggleCompleteTask(item),
  });
  if (item.status === "pending" && taskHasPlannedTime(item)) {
    items.push({ label: "转为事件", onClick: () => handlers.onConvertTaskToEvent(item) });
  }
  items.push({
    label: "删除",
    danger: true,
    onClick: () => handlers.onDeleteTask(item),
  });
  return items;
}
