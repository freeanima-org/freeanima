import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { TaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";

describe("listCompletedTasksForRange via listCalendarRange", () => {
  afterEach(() => {
    mock.restore();
  });

  test("include_completed 时 listCompletedActivity 收到 container=any", async () => {
    const completedMod = await import("@freeanima/features/task/domain/completed-activity.ts");
    const listCompleted = spyOn(completedMod, "listCompletedActivity").mockImplementation(
      async () => [],
    );
    const entityMod = await import("@freeanima/habitat/core/db/pg/entity");
    spyOn(entityMod, "searchEntities").mockImplementation(async () => ({
      query: null,
      limit: 500,
      offset: 0,
      count: 0,
      results: [],
    }));
    const eventStore = await import("./event-store.ts");
    spyOn(eventStore, "listCalendarEvents").mockImplementation(async () => []);

    const { listCalendarRange } = await import("./range-store.ts");
    await listCalendarRange(
      { worldId: 1 },
      {
        from: "2026-08-21T00:00:00+08:00",
        to: "2026-08-22T00:00:00+08:00",
        kinds: ["task"],
        include_completed: true,
      },
    );

    expect(listCompleted).toHaveBeenCalled();
    const filters = listCompleted.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(filters).toMatchObject({
      status: "completed",
      roots_only: true,
      container: TaskContainer.ANY,
    });
  });
});
