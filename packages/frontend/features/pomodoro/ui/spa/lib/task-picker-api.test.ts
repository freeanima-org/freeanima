import { describe, expect, test } from "bun:test";

import type { CalendarRangeItem } from "@freeanima/features/calendar/ui/spa/lib/api.ts";

import {
  filterPomodoroAgendaCandidates,
  formatPomodoroLinkLabel,
  mergePomodoroLinkRows,
  pomodoroLinkBadgeLabel,
  type PomodoroLinkPickRow,
} from "./task-picker-api.ts";

describe("task-picker-api helpers", () => {
  test("pomodoroLinkBadgeLabel 显示清单/项目名称", () => {
    expect(
      pomodoroLinkBadgeLabel({
        kind: "task",
        id: 1,
        title: "ECS 底座",
        status: "pending",
        list_name: "稍后阅读模块",
        project_title: null,
        project_id: null,
        list_id: 3,
        updated_at: "",
      }),
    ).toBe("稍后阅读模块");

    expect(
      pomodoroLinkBadgeLabel({
        kind: "task",
        id: 2,
        title: "ECS 底座",
        status: "pending",
        list_name: null,
        project_title: "剪藏 / Web Clipper",
        project_id: 9,
        list_id: null,
        updated_at: "",
      }),
    ).toBe("剪藏 / Web Clipper");

    expect(pomodoroLinkBadgeLabel({ kind: "event", id: 3, title: "假日安排、调休" })).toBe("事件");
  });

  test("formatPomodoroLinkLabel 紧凑文案为 badge · 标题", () => {
    expect(
      formatPomodoroLinkLabel({
        kind: "task",
        id: 1,
        title: "ECS 底座",
        status: "pending",
        list_name: "稍后阅读模块",
        project_title: null,
        project_id: null,
        list_id: 3,
        updated_at: "",
      }),
    ).toBe("稍后阅读模块 · ECS 底座");

    expect(formatPomodoroLinkLabel({ kind: "event", id: 3, title: "假日安排、调休" })).toBe(
      "事件 · 假日安排、调休",
    );
  });

  test("mergePomodoroLinkRows 任务优先保留归属字段", () => {
    const bare: PomodoroLinkPickRow = {
      kind: "task",
      id: 1,
      title: "A",
      status: "pending",
      list_name: null,
      project_title: null,
      project_id: null,
      list_id: 2,
      updated_at: "",
    };
    const rich: PomodoroLinkPickRow = {
      ...bare,
      list_name: "清单甲",
    };
    const merged = mergePomodoroLinkRows([bare, rich]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.kind === "task" && merged[0].list_name).toBe("清单甲");
  });

  test("filterPomodoroAgendaCandidates 仅保留事件与 pending 任务", () => {
    const today = "2026-08-24";
    const items: CalendarRangeItem[] = [
      {
        kind: "event",
        id: 1,
        title: "会议",
        content: "",
        start_at: `${today}T10:00:00+08:00`,
        end_at: `${today}T11:00:00+08:00`,
        all_day: false,
        remind_at: null,
      },
      {
        kind: "task",
        id: 2,
        title: "待办",
        start_at: null,
        end_at: null,
        due_at: `${today}T12:00:00+08:00`,
        status: "pending",
        priority: "none",
        project_id: null,
        list_id: 1,
      },
      {
        kind: "task",
        id: 3,
        title: "已完成",
        start_at: null,
        end_at: null,
        due_at: `${today}T12:00:00+08:00`,
        status: "completed",
        priority: "none",
        project_id: null,
        list_id: 1,
      },
      {
        kind: "holiday",
        id: "cn-holiday",
        source: "cn_holiday",
        title: "节日",
        start_at: `${today}T00:00:00+08:00`,
        end_at: `${today}T23:59:59+08:00`,
        all_day: true,
      },
    ];
    const filtered = filterPomodoroAgendaCandidates(
      items,
      today,
      new Date(`${today}T09:00:00+08:00`),
    );
    expect(filtered.map((item) => `${item.kind}:${item.id}`)).toEqual(["event:1", "task:2"]);
  });
});
