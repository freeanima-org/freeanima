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

import type { ProjectRow, TaskItemRow } from "./api.ts";
import {
  compactProjectOutbox,
  offlineCreateProject,
  offlineCreateProjectFolder,
  offlineCreateProjectTask,
  offlineUpdateProjectTask,
  reconcileServerProjects,
} from "./offline-store.ts";
import { writeCachedProjectItems, writeCachedProjects } from "./offline-cache.ts";

function project(partial: Partial<ProjectRow> & Pick<ProjectRow, "id" | "title">): ProjectRow {
  return {
    content: "",
    folder_id: null,
    start_at: "2026-07-15T00:00:00.000Z",
    end_at: "2026-07-22T00:00:00.000Z",
    completion_criteria: "done",
    status: "active",
    product_tag: null,
    sort_order: 0,
    task_count: 0,
    milestone_count: 0,
    linked_diary_ids: [],
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...partial,
  };
}

function item(
  partial: Partial<TaskItemRow> & Pick<TaskItemRow, "id" | "title" | "project_id">,
): TaskItemRow {
  return {
    content: "",
    tags: [],
    status: "pending",
    priority: "none",
    due_at: null,
    remind_at: null,
    list_id: null,
    milestone_id: null,
    sort_order: 0,
    completed_at: null,
    created_at: "2026-07-15T00:00:00.000Z",
    updated_at: "2026-07-15T00:00:00.000Z",
    ...partial,
  };
}

describe("reconcileServerProjects", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("保留 outbox 中仍未同步的 temp 项目", async () => {
    const scope = resolveOutboxScope();
    const tempId = -1;
    await writeOfflineCache(scope, "project", "projects", [
      project({ id: tempId, title: "pending" }),
      project({ id: 10, title: "synced" }),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "project",
      method: "project.create",
      payload: { subject_kind: "user" },
      tempEntityId: tempId,
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    const merged = await reconcileServerProjects([project({ id: 10, title: "synced" })]);
    expect(merged.map((e) => e.id)).toEqual([tempId, 10]);
  });

  it("temp 已同步后不再保留", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "project", "projects", [project({ id: -1, title: "old-temp" })]);
    const merged = await reconcileServerProjects([project({ id: 15, title: "old-temp" })]);
    expect(merged.map((e) => e.id)).toEqual([15]);
  });
});

describe("offlineCreateProject dependsOn folder", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("在 temp folder 下创建项目时带 dependsOn", async () => {
    const folderRow = await offlineCreateProjectFolder({ name: "folder" });
    expect(folderRow.id).toBeLessThan(0);

    const created = await offlineCreateProject({
      title: "proj",
      start_at: "2026-07-15T00:00:00.000Z",
      end_at: "2026-07-22T00:00:00.000Z",
      completion_criteria: "done",
      folder_id: folderRow.id,
    });
    expect(created.id).toBeLessThan(0);
    expect(created.folder_id).toBe(folderRow.id);

    const scope = resolveOutboxScope();
    const ops = await listOutboxOps(scope, "project");
    const createOp = ops.find((op) => op.method === "project.create");
    expect(createOp?.dependsOn).toEqual([{ tempId: folderRow.id, field: "folder_id" }]);
  });
});

describe("offlineUpdateProjectTask temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("create flush 后可用 temp id 更新", async () => {
    const scope = resolveOutboxScope();
    const projectId = 10;
    await writeCachedProjects(scope, [project({ id: projectId, title: "p" })]);

    const created = await offlineCreateProjectTask({
      title: "new task",
      project_id: projectId,
    });
    expect(created.id).toBeLessThan(0);

    const serverId = 88;
    await setIdMapping(scope, "project", created.id, serverId);
    await writeCachedProjectItems(scope, projectId, [
      item({ id: serverId, title: "new task", project_id: projectId }),
    ]);

    const updated = await offlineUpdateProjectTask(created.id, { title: "renamed" });
    expect(updated.id).toBe(serverId);
    expect(updated.title).toBe("renamed");

    const ops = await listOutboxOps(scope, "project");
    const patch = ops.find((op) => op.method === "task.patch");
    expect(patch?.payload.id).toBe(serverId);
  });
});

describe("compactProjectOutbox", () => {
  it("把 temp 上的 patch 吸收进 create", () => {
    const compacted = compactProjectOutbox([
      {
        id: "c1",
        moduleId: "project",
        method: "project.create",
        payload: { title: "a", subject_kind: "user" },
        tempEntityId: -1,
        createdAt: "2026-07-15T00:00:00.000Z",
      },
      {
        id: "p1",
        moduleId: "project",
        method: "project.patch",
        payload: { id: -1, title: "b", subject_kind: "user" },
        createdAt: "2026-07-15T00:01:00.000Z",
      },
    ]);
    expect(compacted).toHaveLength(1);
    expect(compacted[0]?.method).toBe("project.create");
    expect(compacted[0]?.payload.title).toBe("b");
  });

  it("删除未同步的 temp create 时丢弃 create", () => {
    const compacted = compactProjectOutbox([
      {
        id: "c1",
        moduleId: "project",
        method: "projectfolder.create",
        payload: { name: "f", subject_kind: "user" },
        tempEntityId: -2,
        createdAt: "2026-07-15T00:00:00.000Z",
      },
      {
        id: "d1",
        moduleId: "project",
        method: "projectfolder.delete",
        payload: { id: -2, subject_kind: "user" },
        createdAt: "2026-07-15T00:01:00.000Z",
      },
    ]);
    expect(compacted).toHaveLength(0);
  });
});
