import { describe, expect, it } from "bun:test";
import {
  RPC_WIRE_METHODS,
  smartlistCreateInputSchema,
  smartlistListInputSchema,
  tasklistCreateInputSchema,
  tasklistListInputSchema,
  tasklistPatchInputSchema,
  tasklistItemListInputSchema,
  tasklistItemCreateInputSchema,
  projectItemCreateInputSchema,
  taskMoveToProjectInputSchema,
  taskMoveToListInputSchema,
} from "@freeanima/shared/rpc-contract";

describe("task SAP procedures", () => {
  it("registers tasklist.* project.item.* task.* and smartlist.* methods", () => {
    expect(RPC_WIRE_METHODS).toContain("tasklist.list");
    expect(RPC_WIRE_METHODS).toContain("tasklist.create");
    expect(RPC_WIRE_METHODS).toContain("tasklist.item.list");
    expect(RPC_WIRE_METHODS).toContain("tasklist.item.create");
    expect(RPC_WIRE_METHODS).toContain("smartlist.list");
    expect(RPC_WIRE_METHODS).toContain("smartlist.create");
    expect(RPC_WIRE_METHODS).toContain("smartlist.patch");
    expect(RPC_WIRE_METHODS).toContain("smartlist.delete");
    expect(RPC_WIRE_METHODS).toContain("project.item.list");
    expect(RPC_WIRE_METHODS).toContain("project.item.create");
    expect(RPC_WIRE_METHODS).toContain("task.moveToProject");
    expect(RPC_WIRE_METHODS).toContain("task.moveToList");
    expect(RPC_WIRE_METHODS).toContain("task.patch");
    expect(RPC_WIRE_METHODS).toContain("task.complete");
    expect(RPC_WIRE_METHODS).toContain("task.delete");
  });

  it("validates task procedure inputs", () => {
    tasklistListInputSchema.parse({});
    tasklistListInputSchema.parse({ include_closed: true });
    smartlistListInputSchema.parse({});
    smartlistCreateInputSchema.parse({
      title: "我的清单",
      filters: { status: "pending" },
    });
    tasklistItemListInputSchema.parse({ list_id: 1, status: "pending" });
    tasklistItemListInputSchema.parse({
      filters: { status: "completed", completed_on: "today" },
    });
    tasklistItemListInputSchema.parse({ filters: { status: "pending", list_ids: [1, 2] } });
    tasklistItemCreateInputSchema.parse({ title: "写文档", list_id: 2 });
    projectItemCreateInputSchema.parse({ title: "项目任务", project_id: 3 });
    taskMoveToProjectInputSchema.parse({ id: 1, project_id: 9 });
    taskMoveToListInputSchema.parse({ id: 1, list_id: 2 });
    tasklistCreateInputSchema.parse({ name: "工作", is_folder: true, parent_id: 10 });
    tasklistPatchInputSchema.parse({ id: 3, parent_id: null, is_folder: false });
  });
});
