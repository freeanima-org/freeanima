import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { TAG_COMPONENT, TASK_ITEM_COMPONENT } from "@freeanima/host/core/db/schema/entity";
import * as entityPg from "@freeanima/host/core/db/pg/entity";

import { setEntityTagIds } from "./tag-store.ts";

function entityRow(
  id: number,
  primary: string,
  body: Record<string, unknown>,
  title: string,
  opts?: { tag_ids?: number[] },
) {
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
    tag_ids: opts?.tag_ids ?? [],
    revisions: [],
    deleted_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("tag-store setEntityTagIds", () => {
  afterEach(() => {
    mock.restore();
  });

  test("rejects tagging a tag entity", async () => {
    spyOn(entityPg, "getEntity").mockResolvedValue(
      entityRow(9, TAG_COMPONENT, { sort_order: 0, client_op_id: null }, "x"),
    );
    spyOn(entityPg, "assertEntityInWorld").mockResolvedValue(undefined);
    await expect(setEntityTagIds(1, 9, [])).rejects.toThrow(/cannot set tags on a tag/);
  });

  test("writes unique tag_ids", async () => {
    const getSpy = spyOn(entityPg, "getEntity").mockImplementation(async (id: number) => {
      if (id === 10) {
        return entityRow(10, TASK_ITEM_COMPONENT, { list_id: 1, status: "pending" }, "task");
      }
      if (id === 1 || id === 2) {
        return entityRow(id, TAG_COMPONENT, { sort_order: 0, client_op_id: null }, `t${id}`);
      }
      return null;
    });
    spyOn(entityPg, "assertEntityInWorld").mockResolvedValue(undefined);
    const updateSpy = spyOn(entityPg, "updateEntity").mockResolvedValue(
      entityRow(10, TASK_ITEM_COMPONENT, { list_id: 1, status: "pending" }, "task", {
        tag_ids: [1, 2],
      }),
    );

    const result = await setEntityTagIds(1, 10, [1, 1, 2]);
    expect(result.tag_ids).toEqual([1, 2]);
    expect(updateSpy).toHaveBeenCalledWith({ id: 10, tag_ids: [1, 2] });
    expect(getSpy).toHaveBeenCalled();
  });
});
