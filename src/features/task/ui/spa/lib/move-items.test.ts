import { describe, expect, mock, spyOn, test, afterEach } from "bun:test";

describe("moveTaskItemsToProject", () => {
  afterEach(() => {
    mock.restore();
  });

  test("对每个 id 调用 moveTaskItemToProject", async () => {
    const api = await import("./api.ts");
    const moveSpy = spyOn(api, "moveTaskItemToProject").mockResolvedValue({
      id: 1,
      title: "t",
      content: "",
      tags: [],
      status: "pending",
      priority: "none",
      due_at: null,
      remind_at: null,
      list_id: null,
      project_id: 9,
      milestone_id: null,
      sort_order: 0,
      completed_at: null,
      created_at: "",
      updated_at: "",
    });

    const { moveTaskItemsToProject } = await import("./move-items.ts");
    await moveTaskItemsToProject([1, 2, 3], 9);

    expect(moveSpy).toHaveBeenCalledTimes(3);
    expect(moveSpy).toHaveBeenCalledWith(1, 9);
    expect(moveSpy).toHaveBeenCalledWith(2, 9);
    expect(moveSpy).toHaveBeenCalledWith(3, 9);
  });
});
