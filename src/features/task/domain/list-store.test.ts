import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { TASK_LIST_COMPONENT } from "@freeanima/core/db/schema/entity";

describe("listTaskLists", () => {
  afterEach(() => {
    mock.restore();
  });

  test("用一次 GROUP BY 计数填充 item_count，不按清单 N+1", async () => {
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
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
      {
        id: 11,
        type: "content",
        world_id: 1,
        primary_component: TASK_LIST_COMPONENT,
        components: [TASK_LIST_COMPONENT],
        title: "Work",
        summary: "",
        content: "",
        body: {
          sort_order: 1,
          closed: false,
          color: null,
          is_default: false,
          is_folder: false,
          parent_id: null,
        },
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
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    const perList = spyOn(entityMod, "countPendingTaskItemsByListId");

    const { listTaskLists } = await import("./list-store.ts");
    const lists = await listTaskLists(1);

    expect(grouped).toHaveBeenCalledTimes(1);
    expect(grouped).toHaveBeenCalledWith(1);
    expect(perList).not.toHaveBeenCalled();
    expect(lists.find((l) => l.id === 10)?.item_count).toBe(3);
    expect(lists.find((l) => l.id === 11)?.item_count).toBe(0);
    expect(lists.find((l) => l.id === 12)?.item_count).toBe(0);
  });

  test("ensureDefaultTaskListForWorld 不调用 listTaskLists 全量计数", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    const grouped = spyOn(entityMod, "countPendingTaskItemsGroupedByListId");
    spyOn(entityMod, "countPendingTaskItemsByListId").mockResolvedValue(2);
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
        created_at: new Date("2026-01-01T00:00:00Z"),
        updated_at: new Date("2026-01-01T00:00:00Z"),
      },
    ]);

    const { ensureDefaultTaskListForWorld } = await import("./list-store.ts");
    const inbox = await ensureDefaultTaskListForWorld(1);

    expect(grouped).not.toHaveBeenCalled();
    expect(inbox.is_default).toBe(true);
    expect(inbox.item_count).toBe(2);
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
