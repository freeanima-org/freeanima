import { describe, expect, test } from "bun:test";

import { TaskContainer, resolveTaskContainer } from "@freeanima/shared/pg-shapes/entity/enums.ts";

describe("resolveTaskContainer", () => {
  test("container 优先于 in_backlog", () => {
    expect(resolveTaskContainer({ container: TaskContainer.ANY, in_backlog: true })).toBe(
      TaskContainer.ANY,
    );
  });

  test("遗留 in_backlog 映射", () => {
    expect(resolveTaskContainer({ in_backlog: true })).toBe(TaskContainer.LIST);
    expect(resolveTaskContainer({ in_backlog: false })).toBe(TaskContainer.ANY);
    expect(resolveTaskContainer({})).toBeUndefined();
  });
});
