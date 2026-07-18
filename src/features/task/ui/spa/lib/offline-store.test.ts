import { beforeEach, describe, expect, it } from "bun:test";

import { writeOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache";
import { setIdMapping } from "@freeanima/frontend/shell-sdk/offline-id-map";
import {
  enqueueOutboxOp,
  listOutboxOps,
  resolveOutboxScope,
  setOfflineOutboxBackendForTests,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import { resetOfflineModuleRegistryForTests } from "@freeanima/frontend/shell-sdk/offline-module-registry";
import { resetTempIdAllocatorForTests } from "@freeanima/frontend/shell-sdk/offline-temp-id";

import type { TaskItemRow, TaskListRow } from "./api.ts";
import {
  offlineCreateTaskItem,
  offlineUpdateTaskItem,
  reconcileServerTaskLists,
} from "./offline-store.ts";
import { writeCachedTaskItems } from "./offline-cache.ts";

function list(partial: Partial<TaskListRow> & Pick<TaskListRow, "id" | "name">): TaskListRow {
  return {
    sort_order: 0,
    closed: false,
    color: null,
    is_default: false,
    is_folder: false,
    parent_id: null,
    item_count: 0,
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...partial,
  };
}

function item(
  partial: Partial<TaskItemRow> & Pick<TaskItemRow, "id" | "title" | "list_id">,
): TaskItemRow {
  return {
    content: "",
    tag_ids: [],
    status: "pending",
    priority: "none",
    due_at: null,
    remind_at: null,
    project_id: null,
    milestone_id: null,
    sort_order: 0,
    completed_at: null,
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...partial,
  };
}

describe("reconcileServerTaskLists", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("保留 outbox 中仍未同步的 temp 清单，避免被服务器列表覆盖丢失", async () => {
    const scope = resolveOutboxScope();
    const tempId = -1;
    await writeOfflineCache(scope, "tasks", "lists", [
      list({ id: tempId, name: "pending" }),
      list({ id: 10, name: "synced" }),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "task",
      method: "tasklist.create",
      payload: { subject_kind: "user" },
      tempEntityId: tempId,
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    const serverItems = [list({ id: 10, name: "synced" })];
    const merged = await reconcileServerTaskLists(serverItems);

    expect(merged.map((e) => e.id)).toEqual([tempId, 10]);
  });

  it("temp 清单已同步（outbox 无 create op）时不再保留，直接采用服务器列表", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "tasks", "lists", [
      list({ id: -1, name: "folder-test1", is_folder: true }),
      list({ id: -3, name: "testlist2" }),
    ]);

    const serverItems = [
      list({ id: 15, name: "folder-test1", is_folder: true }),
      list({ id: 17, name: "testlist2" }),
    ];
    const merged = await reconcileServerTaskLists(serverItems);

    expect(merged.map((e) => e.id)).toEqual([15, 17]);
  });

  it("未 flush 的 parent_id patch 会叠到服务端列表上", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "tasks", "lists", [
      list({ id: 17, name: "testlist2", parent_id: null, sort_order: 1 }),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-patch",
      moduleId: "task",
      method: "tasklist.patch",
      payload: {
        subject_kind: "user",
        id: 17,
        parent_id: null,
        sort_order: 1,
      },
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    const serverItems = [
      list({ id: 15, name: "folder", is_folder: true }),
      list({ id: 17, name: "testlist2", parent_id: 15, sort_order: 0 }),
    ];
    const merged = await reconcileServerTaskLists(serverItems);
    const moved = merged.find((row) => row.id === 17);
    expect(moved?.parent_id).toBeNull();
    expect(moved?.sort_order).toBe(1);
  });
});

describe("offlineUpdateTaskItem temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("create flush 后本地只剩 server id 时，仍可用 temp id 更新", async () => {
    const scope = resolveOutboxScope();
    const listId = 10;
    await writeOfflineCache(scope, "tasks", "lists", [list({ id: listId, name: "inbox" })]);

    const created = await offlineCreateTaskItem({
      title: "new task",
      list_id: listId,
    });
    expect(created.id).toBeLessThan(0);

    const serverId = 88;
    await setIdMapping(scope, "task", created.id, serverId);
    await writeCachedTaskItems(scope, listId, [
      item({ id: serverId, title: "new task", list_id: listId }),
    ]);

    const updated = await offlineUpdateTaskItem(created.id, { title: "renamed" });
    expect(updated.id).toBe(serverId);
    expect(updated.title).toBe("renamed");

    const ops = await listOutboxOps(scope, "task");
    const patch = ops.find((op) => op.method === "task.patch");
    expect(patch?.payload.id).toBe(serverId);
  });

  it("本地缓存未命中时可用 seed 写入后再 patch（智能清单场景）", async () => {
    const scope = resolveOutboxScope();
    const listId = 17;
    await writeOfflineCache(scope, "tasks", "lists", [list({ id: listId, name: "testlist2" })]);
    // 故意不写 items 缓存，模拟智能清单只拉了内存行

    const seed = item({
      id: 53,
      title: "33",
      list_id: listId,
      tag_ids: [],
    });
    const updated = await offlineUpdateTaskItem(53, { tag_ids: [1, 2] }, { seed });
    expect(updated.id).toBe(53);
    expect(updated.tag_ids).toEqual([1, 2]);

    const ops = await listOutboxOps(scope, "task");
    const patch = ops.find((op) => op.method === "task.patch");
    expect(patch?.payload.id).toBe(53);
    expect(patch?.payload.tag_ids).toEqual([1, 2]);
  });
});
