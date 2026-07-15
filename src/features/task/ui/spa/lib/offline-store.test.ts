import { beforeEach, describe, expect, it } from "bun:test";

import { writeOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache";
import {
  enqueueOutboxOp,
  resolveOutboxScope,
  setOfflineOutboxBackendForTests,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import { resetOfflineModuleRegistryForTests } from "@freeanima/frontend/shell-sdk/offline-module-registry";

import type { TaskListRow } from "./api.ts";
import { reconcileServerTaskLists } from "./offline-store.ts";

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

describe("reconcileServerTaskLists", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
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
