import { describe, expect, test } from "bun:test";

import { taskDeleteDetachesCarrier } from "./task-delete.ts";

describe("taskDeleteDetachesCarrier", () => {
  test("primary task_item → soft-delete entity", () => {
    expect(taskDeleteDetachesCarrier("task_item")).toBe(false);
  });

  test("mounted facet (e.g. email) → detach only", () => {
    expect(taskDeleteDetachesCarrier("email_message")).toBe(true);
    expect(taskDeleteDetachesCarrier("calendar_event")).toBe(true);
  });

  test("nullish primary → treat as soft-delete path", () => {
    expect(taskDeleteDetachesCarrier(null)).toBe(false);
    expect(taskDeleteDetachesCarrier(undefined)).toBe(false);
  });
});
