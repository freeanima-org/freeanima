import { expect, it } from "bun:test";

import { parseTaskItemSearchFilters } from "./search-filters.ts";

it("parseTaskItemSearchFilters accepts task_item filter shape", () => {
  const parsed = parseTaskItemSearchFilters({
    list_id: 2,
    status: "pending",
    tags: ["工作"],
    due_today: true,
  });
  expect(parsed.list_id).toBe(2);
  expect(parsed.status).toBe("pending");
  expect(parsed.tags).toEqual(["工作"]);
  expect(parsed.due_today).toBe(true);
});

it("parseTaskItemSearchFilters rejects unknown fields", () => {
  expect(() => parseTaskItemSearchFilters({ foo: "bar" })).toThrow(/invalid task_item filters/);
});
