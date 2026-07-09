import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

describe("listTaskItems filters", () => {
  afterEach(() => {
    mock.restore();
  });

  test("传 filters 时走 filter_only 搜索", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
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
        filters: { status: "pending", due_on: "today" },
      }),
    );
  });
});
