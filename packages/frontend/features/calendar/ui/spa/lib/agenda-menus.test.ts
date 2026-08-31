import { describe, expect, it, mock } from "bun:test";

import { buildAgendaMenuItems, type AgendaMenuHandlers } from "./agenda-menus.ts";
import type { CalendarRangeItem } from "./api.ts";

function handlers(): AgendaMenuHandlers {
  return {
    onEditEvent: mock(() => {}),
    onStartPomodoroEvent: mock(() => {}),
    onConvertEventToTask: mock(() => {}),
    onDeleteEvent: mock(() => {}),
    onEditTask: mock(() => {}),
    onStartPomodoroTask: mock(() => {}),
    onToggleCompleteTask: mock(() => {}),
    onConvertTaskToEvent: mock(() => {}),
    onDeleteTask: mock(() => {}),
    onOpenProject: mock(() => {}),
  };
}

describe("buildAgendaMenuItems", () => {
  it("事件含编辑/番茄/转任务/删除", () => {
    const item: CalendarRangeItem = {
      kind: "event",
      id: 1,
      title: "会议",
      content: "",
      start_at: "2026-08-31T10:00:00+08:00",
      end_at: null,
      all_day: false,
      remind_at: null,
    };
    const labels = buildAgendaMenuItems(item, handlers()).map((i) => i.label);
    expect(labels).toEqual(["编辑", "开始番茄", "转为任务", "删除"]);
  });

  it("pending 任务含番茄与转为事件", () => {
    const item: CalendarRangeItem = {
      kind: "task",
      id: 2,
      title: "写文档",
      start_at: "2026-08-31T09:00:00+08:00",
      end_at: null,
      due_at: null,
      status: "pending",
      priority: "none",
      project_id: null,
      list_id: 1,
    };
    const labels = buildAgendaMenuItems(item, handlers()).map((i) => i.label);
    expect(labels).toEqual(["编辑", "开始番茄", "标记完成", "转为事件", "删除"]);
  });

  it("已完成任务无番茄、可标记未完成", () => {
    const item: CalendarRangeItem = {
      kind: "task",
      id: 3,
      title: "已做",
      status: "completed",
      priority: "none",
      project_id: null,
      list_id: 1,
      completed_at: "2026-08-31T12:00:00+08:00",
    };
    const labels = buildAgendaMenuItems(item, handlers()).map((i) => i.label);
    expect(labels).toEqual(["编辑", "标记未完成", "删除"]);
  });

  it("项目仅打开；节日无菜单", () => {
    const project: CalendarRangeItem = {
      kind: "project",
      id: 4,
      title: "风巢",
      start_at: null,
      end_at: null,
      status: "active",
    };
    expect(buildAgendaMenuItems(project, handlers()).map((i) => i.label)).toEqual(["打开"]);

    const holiday: CalendarRangeItem = {
      kind: "holiday",
      id: "cn-2026-10-01",
      source: "cn_holiday",
      title: "国庆",
      start_at: "2026-10-01T00:00:00+08:00",
      end_at: null,
      all_day: true,
    };
    expect(buildAgendaMenuItems(holiday, handlers())).toEqual([]);
  });
});
