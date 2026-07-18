import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { TASK_LIST_COMPONENT } from "@freeanima/core/db/schema/entity";

describe("listTaskLists", () => {
  afterEach(() => {
    mock.restore();
  });

  test("list 不查询 item_count（次要数据走 stats）", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    const grouped = spyOn(entityMod, "countPendingTaskItemsGroupedByListId");
    spyOn(entityMod, "listEntities").mockResolvedValue([
      {
        id: 10,
        type: "content",
        world_id: 1,
        primary_component: TASK_LIST_COMPONENT,
        components: [TASK_LIST_COMPONENT],
        title: "收件箱",
        summary: "",
        content: "",
        body: {
          sort_order: 0,
          closed: false,
          color: null,
          is_default: true,
          is_folder: false,
          parent_id: null,
        },
        pinned: false,
        reference_count: 0,
        tag_ids: [],
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const { listTaskLists } = await import("./list-store.ts");
    const lists = await listTaskLists(1);

    expect(grouped).not.toHaveBeenCalled();
    expect(lists.find((l) => l.id === 10)?.item_count).toBeUndefined();
  });

  test("ensureDefaultTaskListForWorld 不调用 list 全量计数", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    const grouped = spyOn(entityMod, "countPendingTaskItemsGroupedByListId");
    spyOn(entityMod, "countPendingTaskItemsByListId");
    spyOn(entityMod, "listEntities").mockResolvedValue([
      {
        id: 10,
        type: "content",
        world_id: 1,
        primary_component: TASK_LIST_COMPONENT,
        components: [TASK_LIST_COMPONENT],
        title: "收件箱",
        summary: "",
        content: "",
        body: {
          sort_order: 0,
          closed: false,
          color: null,
          is_default: true,
          is_folder: false,
          parent_id: null,
        },
        pinned: false,
        reference_count: 0,
        tag_ids: [],
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const { ensureDefaultTaskListForWorld } = await import("./list-store.ts");
    const inbox = await ensureDefaultTaskListForWorld(1);

    expect(grouped).not.toHaveBeenCalled();
    expect(inbox.is_default).toBe(true);
    expect(inbox.item_count).toBeUndefined();
  });

  test("ensure 无默认箱时在 advisory lock 内 createEntity", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    const pgMod = await import("@freeanima/core/db/pg");
    spyOn(pgMod, "withAdvisoryXactLock").mockImplementation(async (_ns, _key, fn) =>
      fn(null as never),
    );
    spyOn(entityMod, "listEntities").mockResolvedValue([]);
    const createdAt = new Date("2026-01-02T00:00:00Z");
    const create = spyOn(entityMod, "createEntity").mockResolvedValue({
      id: 99,
      type: "content",
      world_id: 1,
      primary_component: TASK_LIST_COMPONENT,
      components: [TASK_LIST_COMPONENT],
      title: "收件箱",
      summary: "",
      content: "",
      body: {
        sort_order: 0,
        closed: false,
        color: null,
        is_default: true,
        is_folder: false,
        parent_id: null,
      },
      pinned: false,
      reference_count: 0,
      tag_ids: [],
      created_at: createdAt,
      updated_at: createdAt,
    });

    const { ensureDefaultTaskListForWorld } = await import("./list-store.ts");
    const inbox = await ensureDefaultTaskListForWorld(1);

    expect(pgMod.withAdvisoryXactLock).toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[1]).toBeNull();
    expect(inbox.id).toBe(99);
    expect(inbox.is_default).toBe(true);
  });
});

describe("listTaskListStats", () => {
  afterEach(() => {
    mock.restore();
  });

  test("用一次 GROUP BY 填充 counts，跳过文件夹", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    const grouped = spyOn(entityMod, "countPendingTaskItemsGroupedByListId").mockResolvedValue(
      new Map([
        [10, 3],
        [11, 0],
      ]),
    );
    spyOn(entityMod, "listEntities").mockResolvedValue([
      {
        id: 10,
        type: "content",
        world_id: 1,
        primary_component: TASK_LIST_COMPONENT,
        components: [TASK_LIST_COMPONENT],
        title: "收件箱",
        summary: "",
        content: "",
        body: {
          sort_order: 0,
          closed: false,
          color: null,
          is_default: true,
          is_folder: false,
          parent_id: null,
        },
        pinned: false,
        reference_count: 0,
        tag_ids: [],
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: 12,
        type: "content",
        world_id: 1,
        primary_component: TASK_LIST_COMPONENT,
        components: [TASK_LIST_COMPONENT],
        title: "Folder",
        summary: "",
        content: "",
        body: {
          sort_order: 2,
          closed: false,
          color: null,
          is_default: false,
          is_folder: true,
          parent_id: null,
        },
        pinned: false,
        reference_count: 0,
        tag_ids: [],
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const { listTaskListStats } = await import("./stats-store.ts");
    const counts = await listTaskListStats(1);

    expect(grouped).toHaveBeenCalledTimes(1);
    expect(counts).toEqual([{ id: 10, item_count: 3 }]);
  });
});
