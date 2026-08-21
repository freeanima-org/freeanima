import { describe, expect, it } from "bun:test";
import {
  RPC_PROTOCOL_METHODS,
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
    expect(RPC_PROTOCOL_METHODS).toContain("tasklist.list");
    expect(RPC_PROTOCOL_METHODS).toContain("tasklist.create");
    expect(RPC_PROTOCOL_METHODS).toContain("tasklist.item.list");
    expect(RPC_PROTOCOL_METHODS).toContain("tasklist.item.create");
    expect(RPC_PROTOCOL_METHODS).toContain("smartlist.list");
    expect(RPC_PROTOCOL_METHODS).toContain("smartlist.create");
    expect(RPC_PROTOCOL_METHODS).toContain("smartlist.patch");
    expect(RPC_PROTOCOL_METHODS).toContain("smartlist.delete");
    expect(RPC_PROTOCOL_METHODS).toContain("project.item.list");
    expect(RPC_PROTOCOL_METHODS).toContain("project.item.create");
    expect(RPC_PROTOCOL_METHODS).toContain("task.moveToProject");
    expect(RPC_PROTOCOL_METHODS).toContain("task.moveToList");
    expect(RPC_PROTOCOL_METHODS).toContain("task.patch");
    expect(RPC_PROTOCOL_METHODS).toContain("task.complete");
    expect(RPC_PROTOCOL_METHODS).toContain("task.delete");
  });

  it("validates task procedure inputs", () => {
    tasklistListInputSchema.parse({ subject_id: 1 });
    tasklistListInputSchema.parse({ subject_id: 1, include_closed: true });
    smartlistListInputSchema.parse({ subject_id: 1 });
    smartlistCreateInputSchema.parse({
      subject_id: 1,
      title: "我的清单",
      filters: { status: "pending" },
    });
    tasklistItemListInputSchema.parse({ subject_id: 1, list_id: 1, status: "pending" });
    tasklistItemListInputSchema.parse({
      subject_id: 1,
      filters: { status: "completed", completed_on: "today" },
    });
    tasklistItemListInputSchema.parse({
      subject_id: 1,
      filters: { status: "pending", list_ids: [1, 2] },
    });
    tasklistItemCreateInputSchema.parse({ subject_id: 1, title: "写文档", list_id: 2 });
    projectItemCreateInputSchema.parse({ subject_id: 1, title: "项目任务", project_id: 3 });
    taskMoveToProjectInputSchema.parse({ subject_id: 1, id: 1, project_id: 9 });
    taskMoveToListInputSchema.parse({ subject_id: 1, id: 1, list_id: 2 });
    tasklistCreateInputSchema.parse({
      subject_id: 1,
      name: "工作",
      is_folder: true,
      parent_id: 10,
    });
    tasklistPatchInputSchema.parse({
      subject_id: 1,
      id: 3,
      parent_id: null,
      is_folder: false,
    });
  });
});
