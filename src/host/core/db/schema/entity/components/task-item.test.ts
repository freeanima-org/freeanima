import { describe, expect, test } from "bun:test";

import { taskItemBodySchema } from "@freeanima/host/core/db/schema/entity/components/task-item.ts";

describe("taskItemBodySchema ownership XOR", () => {
  test("清单任务：list_id 有值、project_id 空", () => {
    const parsed = taskItemBodySchema.safeParse({
      list_id: 2,
      project_id: null,
      status: "pending",
      priority: "none",
      tags: [],
      client_op_id: null,
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
      tags: [],
      client_op_id: null,
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
      tags: [],
      client_op_id: null,
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
      tags: [],
      client_op_id: null,
    });
    expect(parsed.success).toBe(false);
  });
});
