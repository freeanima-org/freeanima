import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { SMART_LIST_COMPONENT } from "@freeanima/core/db/schema/entity";

describe("listSmartListsMerged", () => {
  afterEach(() => {
    mock.restore();
  });

  test("合并内置 preset 与自定义 entity，均含 filters", async () => {
    const entityMod = await import("@freeanima/core/db/pg/entity");
    spyOn(entityMod, "listEntities").mockImplementation(async () => [
      {
        id: 42,
        type: "content",
        world_id: 1,
        primary_component: SMART_LIST_COMPONENT,
        components: [SMART_LIST_COMPONENT],
        title: "高优先级",
        content: "",
        summary: "",
        body: { sort_order: 20, filters: { status: "pending", priority: "high" } },
        created_at: new Date("2024-06-01T00:00:00.000Z"),
        updated_at: new Date("2024-06-01T00:00:00.000Z"),
      },
    ]);

    const { listSmartListsMerged } = await import("./smart-list-store.ts");
    const rows = await listSmartListsMerged(1);

    expect(rows.length).toBe(7);
    expect(rows.filter((r) => r.preset != null).length).toBe(6);
    expect(rows.find((r) => r.id === 42)?.filters).toEqual({
      status: "pending",
      priority: "high",
    });
    for (const row of rows) {
      expect(Object.keys(row.filters).length).toBeGreaterThan(0);
    }
  });
});
