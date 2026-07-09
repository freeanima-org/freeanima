import { describe, expect, it } from "bun:test";
import {
  SAP_METHODS,
  smartlistCreateInputSchema,
  smartlistListInputSchema,
  tasklistCreateInputSchema,
  tasklistListInputSchema,
  tasklistPatchInputSchema,
  taskListInputSchema,
  taskCreateInputSchema,
} from "@freeanima/shared/sap-contract";

describe("task SAP procedures", () => {
  it("registers tasklist.* task.* and smartlist.* methods", () => {
    expect(SAP_METHODS).toContain("tasklist.list");
    expect(SAP_METHODS).toContain("tasklist.create");
    expect(SAP_METHODS).toContain("smartlist.list");
    expect(SAP_METHODS).toContain("smartlist.create");
    expect(SAP_METHODS).toContain("smartlist.patch");
    expect(SAP_METHODS).toContain("smartlist.delete");
    expect(SAP_METHODS).toContain("task.list");
    expect(SAP_METHODS).toContain("task.create");
    expect(SAP_METHODS).toContain("task.complete");
    expect(SAP_METHODS).toContain("task.delete");
  });

  it("validates task procedure inputs", () => {
    tasklistListInputSchema.parse({});
    tasklistListInputSchema.parse({ include_closed: true });
    smartlistListInputSchema.parse({});
    smartlistCreateInputSchema.parse({
      title: "我的清单",
      filters: { status: "pending" },
    });
    taskListInputSchema.parse({ list_id: 1, status: "pending" });
    taskListInputSchema.parse({ filters: { status: "completed", completed_on: "today" } });
    taskListInputSchema.parse({ filters: { status: "pending", list_ids: [1, 2] } });
    taskCreateInputSchema.parse({ title: "写文档", list_id: 2 });
    tasklistCreateInputSchema.parse({ name: "工作", is_folder: true, parent_id: 10 });
    tasklistPatchInputSchema.parse({ id: 3, parent_id: null, is_folder: false });
  });
});
