import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

describe("listTaskItems filters", () => {
  afterEach(() => {
    mock.restore();
  });

  test("传 filters 时走 filter_only 搜索", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    const searchSpy = spyOn(entityMod, "searchEntities").mockImplementation(async () => ({
      query: null,
      limit: 500,
      offset: 0,
      count: 0,
      results: [],
    }));

    const { listTaskItems } = await import("./item-store.ts");
    await listTaskItems(1, {
      filters: { status: "pending", due_on: "today" },
    });

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 1,
        mode: "filter_only",
        filters: {
          status: "pending",
          due_on: "today",
          in_backlog: true,
          roots_only: true,
        },
      }),
    );
  });

  test("传 project_id 时按项目过滤且不加 in_backlog", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    const searchSpy = spyOn(entityMod, "searchEntities").mockImplementation(async () => ({
      query: null,
      limit: 500,
      offset: 0,
      count: 0,
      results: [],
    }));

    const { listTaskItems } = await import("./item-store.ts");
    await listTaskItems(1, { project_id: 42, status: "pending" });

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 1,
        mode: "filter_only",
        filters: { project_id: 42, status: "pending", roots_only: true },
      }),
    );
  });
});

describe("searchTaskItems filters", () => {
  afterEach(() => {
    mock.restore();
  });

  test("传 project_id 时写入 hybrid filters", async () => {
    const entityMod = await import("@freeanima/host/core/db/pg/entity");
    const searchSpy = spyOn(entityMod, "searchEntities").mockImplementation(async () => ({
      query: "foo",
      limit: 30,
      offset: 0,
      count: 0,
      results: [],
    }));

    const { searchTaskItems } = await import("./item-store.ts");
    await searchTaskItems(1, { query: "foo", project_id: 42 });

    expect(searchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        world_id: 1,
        mode: "hybrid",
        query: "foo",
        filters: { project_id: 42 },
      }),
    );
  });
});
