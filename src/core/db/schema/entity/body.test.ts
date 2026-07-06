import { describe, expect, test } from "bun:test";

import { mergeComponentBody, validateEntityBody, validatePrimaryComponentBody } from "./body.ts";
import { TASK_ITEM_COMPONENT } from "./components/task-item.ts";

describe("validateEntityBody", () => {
  test("accepts valid task_item body", () => {
    const body = validatePrimaryComponentBody(TASK_ITEM_COMPONENT, {
      title: "Buy milk",
      status: "pending",
      priority: "high",
      list_id: 2,
      tags: [],
    });
    expect(body.title).toBe("Buy milk");
    expect(body.status).toBe("pending");
  });

  test("rejects unknown component tag", () => {
    expect(() => validateEntityBody(["not_a_component"], {})).toThrow(/unknown component/);
  });

  test("rejects invalid task_item body", () => {
    expect(() =>
      validatePrimaryComponentBody(TASK_ITEM_COMPONENT, {
        title: "x",
        list_id: -1,
      }),
    ).toThrow(/invalid body for component task_item/);
  });

  test("mergeComponentBody validates merged result", () => {
    const merged = mergeComponentBody(
      { title: "a", status: "pending", priority: "none", list_id: 2, tags: [] },
      { status: "completed" },
      [TASK_ITEM_COMPONENT],
    );
    expect(merged.status).toBe("completed");
  });
});
