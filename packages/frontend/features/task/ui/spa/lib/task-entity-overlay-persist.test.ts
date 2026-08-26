import { describe, expect, it } from "bun:test";
import { createAutoPersistScheduler } from "@freeanima/ui-kit/lib/auto-persist-schedule.ts";

import {
  buildTaskOverlayFieldPatch,
  classifyTaskOverlayChange,
} from "./task-entity-overlay-persist.ts";
import type { TaskItemRow } from "./api.ts";

const base: TaskItemRow = {
  id: 1,
  title: "任务",
  content: "正文",
  tag_ids: [1],
  status: "pending",
  priority: "none",
  due_at: null,
  remind_at: null,
  list_id: 10,
  project_id: null,
  sort_order: 0,
  completed_at: null,
  primary_component: "task_item",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const dailyRecurrence = {
  freq: "daily" as const,
  interval: 1,
  anchor: "due" as const,
  schedule_at: "2026-01-01T09:00:00+08:00",
  skip: "none" as const,
  workdays_only: false,
  calendar: "gregorian" as const,
};

describe("classifyTaskOverlayChange", () => {
  it("status 变更归为 status（完成路径，禁止 debounce）", () => {
    expect(classifyTaskOverlayChange(base, { ...base, status: "completed" })).toBe("status");
    expect(
      classifyTaskOverlayChange({ ...base, status: "completed" }, { ...base, status: "pending" }),
    ).toBe("status");
  });

  it("仅字段变更归为 fields（可 debounce）", () => {
    const next: TaskItemRow = { ...base, title: "新标题" };
    expect(classifyTaskOverlayChange(base, next)).toBe("fields");
  });
});

describe("buildTaskOverlayFieldPatch", () => {
  it("不含 status，避免文本 debounce 误写完成态", () => {
    const patch = buildTaskOverlayFieldPatch({
      ...base,
      status: "completed",
      title: "新标题",
    });
    expect(patch).not.toHaveProperty("status");
    expect(patch.title).toBe("新标题");
    expect(patch.content).toBe("正文");
  });

  it("有 recurrence 时带 only_this", () => {
    const patch = buildTaskOverlayFieldPatch({
      ...base,
      recurrence: dailyRecurrence,
    });
    expect(patch.only_this).toBe(true);
    expect(patch.recurrence).toEqual(dailyRecurrence);
  });
});

describe("文本路径 unmount flush", () => {
  it("有 pending 时 flush 立即落盘；cancel 不落盘", () => {
    let fires = 0;
    let now = 0;
    const timers = new Map<unknown, () => void>();
    let nextId = 1;
    const scheduler = createAutoPersistScheduler({
      debounceMs: 700,
      maxWaitMs: 2000,
      now: () => now,
      setTimeoutFn: (handler, _ms) => {
        const id = nextId++;
        timers.set(id, handler);
        return id;
      },
      clearTimeoutFn: (id) => {
        timers.delete(id);
      },
      onFire: () => {
        fires += 1;
      },
    });

    scheduler.schedule();
    expect(fires).toBe(0);
    scheduler.flush();
    expect(fires).toBe(1);

    fires = 0;
    scheduler.schedule();
    scheduler.cancel();
    scheduler.flush();
    expect(fires).toBe(0);
  });
});
