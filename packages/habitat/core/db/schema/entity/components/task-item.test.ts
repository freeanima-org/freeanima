import { describe, expect, test } from "bun:test";

import { taskItemBodySchema } from "@freeanima/habitat/core/db/schema/entity/components/task-item.ts";

describe("taskItemBodySchema ownership XOR", () => {
  test("清单任务：list_id 有值、project_id 空", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.list_id).toBe(2);
      expect(parsed.data.project_id).toBeNull();
    }
  });

  test("项目任务：project_id 有值、list_id 空", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: null,
      project_id: 10,
      status: "pending",
      priority: "none",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.list_id).toBeNull();
      expect(parsed.data.project_id).toBe(10);
    }
  });

  test("存量双归属：预处理清空 list_id", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: 10,
      status: "pending",
      priority: "none",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.list_id).toBeNull();
      expect(parsed.data.project_id).toBe(10);
    }
  });

  test("两者皆空失败", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: null,
      project_id: null,
      status: "pending",
      priority: "none",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("taskItemBodySchema 计划 / deadline / 提醒", () => {
  test("无计划且无 due 时预处理剥离 recurrence 与 reminders", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",

      due_at: null,
      start_at: null,
      end_at: null,
      remind_at: "2026-08-01T08:00:00+08:00",
      reminders: [{ at: "2026-08-01T08:00:00+08:00" }],
      recurrence: {
        freq: "daily",
        interval: 1,
        anchor: "due",
        schedule_at: "2026-08-01T09:00:00+08:00",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.recurrence).toBeNull();
      expect(parsed.data.remind_at).toBeNull();
      expect(parsed.data.reminders).toEqual([]);
    }
  });

  test("仅 due_at 为真 deadline（迁移后语义）", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: null,
      project_id: 10,
      status: "pending",
      priority: "none",

      due_at: "2026-08-01T09:00:00+08:00",
      reminders: [{ at: "2026-08-01T08:00:00+08:00", anchor: "due" }],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.due_at).toBe("2026-08-01T09:00:00+08:00");
      expect(parsed.data.start_at ?? null).toBeNull();
    }
  });

  test("计划单点 + 独立 deadline", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",

      start_at: "2026-08-01T08:00:00+08:00",
      end_at: null,
      due_at: "2026-08-05T18:00:00+08:00",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.start_at).toBe("2026-08-01T08:00:00+08:00");
      expect(parsed.data.due_at).toBe("2026-08-05T18:00:00+08:00");
    }
  });

  test("start_at 晚于 end_at 失败", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",

      start_at: "2026-08-02T09:00:00+08:00",
      end_at: "2026-08-01T09:00:00+08:00",
    });
    expect(parsed.success).toBe(false);
  });

  test("仅 deadline 允许提醒，不允许 recurrence", () => {
    const ok = taskItemBodySchema.safeParse({
      list_id: null,
      project_id: 10,
      status: "pending",
      priority: "none",

      due_at: "2026-08-10T18:00:00+08:00",
      end_at: null,
      reminders: [{ at: "2026-08-10T09:00:00+08:00", anchor: "due" }],
    });
    expect(ok.success).toBe(true);

    const bad = taskItemBodySchema.safeParse({
      list_id: null,
      project_id: 10,
      status: "pending",
      priority: "none",

      due_at: "2026-08-10T18:00:00+08:00",
      end_at: "2026-08-10T18:00:00+08:00",
      recurrence: {
        freq: "daily",
        interval: 1,
        anchor: "due",
        schedule_at: "2026-08-10T18:00:00+08:00",
      },
    });
    // end without start stripped → only due → recurrence stripped in preprocess
    expect(bad.success).toBe(true);
    if (bad.success) {
      expect(bad.data.recurrence).toBeNull();
      expect(bad.data.end_at ?? null).toBeNull();
    }
  });

  test("有计划时允许 recurrence / reminders；due 可并存", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",

      start_at: "2026-08-01T08:00:00+08:00",
      end_at: "2026-08-01T09:00:00+08:00",
      due_at: "2026-08-05T18:00:00+08:00",
      remind_at: "2026-08-01T08:00:00+08:00",
      reminders: [{ at: "2026-08-01T08:00:00+08:00", anchor: "start" }],
      recurrence: {
        freq: "daily",
        interval: 1,
        anchor: "due",
        schedule_at: "2026-08-01T09:00:00+08:00",
      },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.start_at).toBe("2026-08-01T08:00:00+08:00");
      expect(parsed.data.end_at).toBe("2026-08-01T09:00:00+08:00");
      expect(parsed.data.due_at).toBe("2026-08-05T18:00:00+08:00");
      expect(parsed.data.recurrence?.freq).toBe("daily");
    }
  });
});
