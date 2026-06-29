import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  tasklistListInputSchema,
  taskListInputSchema,
  taskCreateInputSchema,
} from "@freeanima/sap-contract";

describe("task SAP procedures", () => {
  it("registers tasklist.* and task.* methods", () => {
    expect(SAP_METHODS).toContain("tasklist.list");
    expect(SAP_METHODS).toContain("tasklist.create");
    expect(SAP_METHODS).toContain("task.list");
    expect(SAP_METHODS).toContain("task.create");
    expect(SAP_METHODS).toContain("task.complete");
    expect(SAP_METHODS).toContain("task.delete");
  });

  it("validates task procedure inputs", () => {
    tasklistListInputSchema.parse({});
    tasklistListInputSchema.parse({ include_closed: true });
    taskListInputSchema.parse({ list_id: 1, status: "pending" });
    taskCreateInputSchema.parse({ title: "写文档", list_id: 2 });
  });
});
