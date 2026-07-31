import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
} from "@freeanima/host/core/db/schema/entity";

function entityRow(id: number, primary: string, body: Record<string, unknown>, title = "x") {
  return {
    id,
    type: "content" as const,
    world_id: 1,
    primary_component: primary,
    components: [primary],
    title,
    summary: "",
    content: "",
    body,
    pinned: false,
    reference_count: 0,
    tag_ids: [],
    revisions: [],
    deleted_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("updateTaskItem ownership XOR", () => {
  afterEach(() => {
    mock.restore();
  });

  test("移入项目时清空 list_id", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    spyOn(entityMod, "getEntity").mockImplementation(async (id: number) => {
      if (id === 1) {
        return entityRow(1, TASK_ITEM_COMPONENT, {
          list_id: 2,
          project_id: null,
          status: "pending",
          priority: "none",
          client_op_id: null,
          sort_order: 0,
        });
      }
      if (id === 2) {
        return entityRow(
          2,
          TASK_LIST_COMPONENT,
          {
            sort_order: 0,
            closed: false,
            color: null,
            is_default: true,
            is_folder: false,
            parent_id: null,
          },
          "收件箱",
        );
      }
      if (id === 10) {
        return entityRow(
          10,
          PROJECT_COMPONENT,
          {
            folder_id: null,
            start_at: "2026-01-01T00:00:00+08:00",
            end_at: "2026-12-31T00:00:00+08:00",
            status: "active",
            sort_order: 0,
            linked_diary_ids: [],
          },
          "P",
        );
      }
      return null;
    });
    spyOn(entityMod, "assertEntityInWorld").mockResolvedValue(undefined);
    spyOn(entityMod, "assertSameWorldReferent").mockResolvedValue(undefined);
    const updateSpy = spyOn(entityMod, "updateEntity").mockImplementation(async (input) =>
      entityRow(1, TASK_ITEM_COMPONENT, {
        list_id: null,
        project_id: 10,
        status: "pending",
        priority: "none",
        client_op_id: null,
        sort_order: 0,
        ...(input.body as object),
      }),
    );

    const { updateTaskItem } = await import("./item-store.ts");
    const row = await updateTaskItem(1, { id: 1, project_id: 10 });
    expect(row?.list_id).toBeNull();
    expect(row?.project_id).toBe(10);
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ project_id: 10, list_id: null }),
      }),
    );
  });

  test("离开项目未传 list_id 时拒绝", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    spyOn(entityMod, "getEntity").mockResolvedValue(
      entityRow(1, TASK_ITEM_COMPONENT, {
        list_id: null,
        project_id: 10,
        status: "pending",
        priority: "none",
        client_op_id: null,
        sort_order: 0,
      }),
    );
    spyOn(entityMod, "assertEntityInWorld").mockResolvedValue(undefined);

    const { updateTaskItem } = await import("./item-store.ts");
    await expect(updateTaskItem(1, { id: 1, project_id: null })).rejects.toThrow(
      /list_id required when leaving project/,
    );
  });
});

describe("releaseTasksFromProject", () => {
  afterEach(() => {
    mock.restore();
  });

  test("释放时写入默认清单 list_id", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    spyOn(entityMod, "listEntities").mockResolvedValue([
      entityRow(
        2,
        TASK_LIST_COMPONENT,
        {
          sort_order: 0,
          closed: false,
          color: null,
          is_default: true,
          is_folder: false,
          parent_id: null,
        },
        "收件箱",
      ),
    ]);
    spyOn(entityMod, "searchEntities").mockResolvedValue({
      query: null,
      limit: 500,
      offset: 0,
      count: 1,
      results: [
        entityRow(5, TASK_ITEM_COMPONENT, {
          list_id: null,
          project_id: 10,
          status: "pending",
          priority: "none",
          client_op_id: null,
        }),
      ],
    });
    const updateSpy = spyOn(entityMod, "updateEntity").mockResolvedValue(
      entityRow(5, TASK_ITEM_COMPONENT, {
        list_id: 2,
        project_id: null,
        status: "pending",
        priority: "none",
        client_op_id: null,
      }),
    );

    const { releaseTasksFromProject } =
      await import("@freeanima/features/project/domain/project-store.ts");
    await releaseTasksFromProject(1, 10);
    expect(updateSpy).toHaveBeenCalledWith({
      id: 5,
      body: { project_id: null, list_id: 2 },
    });
  });
});

describe("updateProject terminal release_tasks", () => {
  afterEach(() => {
    mock.restore();
  });

  test("终态默认不释放任务", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    spyOn(entityMod, "getEntity").mockResolvedValue(
      entityRow(
        10,
        PROJECT_COMPONENT,
        {
          folder_id: null,
          start_at: "2026-01-01T00:00:00+08:00",
          end_at: "2026-12-31T00:00:00+08:00",
          status: "active",
          sort_order: 0,
          linked_diary_ids: [],
        },
        "P",
      ),
    );
    spyOn(entityMod, "assertEntityInWorld").mockResolvedValue(undefined);
    spyOn(entityMod, "updateEntity").mockResolvedValue(
      entityRow(
        10,
        PROJECT_COMPONENT,
        {
          folder_id: null,
          start_at: "2026-01-01T00:00:00+08:00",
          end_at: "2026-12-31T00:00:00+08:00",
          status: "completed",
          sort_order: 0,
          linked_diary_ids: [],
        },
        "P",
      ),
    );
    const searchSpy = spyOn(entityMod, "searchEntities").mockResolvedValue({
      query: null,
      limit: 500,
      offset: 0,
      count: 0,
      results: [],
    });
    spyOn(entityMod, "listEntities").mockResolvedValue([]);

    const { updateProject } = await import("@freeanima/features/project/domain/project-store.ts");
    await updateProject(1, { id: 10, status: "completed" });

    // 默认不释放：不应 search project tasks（task_count 已迁至 project.stats）
    const projectTaskSearches = searchSpy.mock.calls.filter(
      (c) => (c[0] as { filters?: { project_id?: number } }).filters?.project_id === 10,
    );
    expect(projectTaskSearches.length).toBe(0);
  });
});
