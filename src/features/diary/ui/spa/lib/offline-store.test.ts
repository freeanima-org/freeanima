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

import type { DiaryEntryRow } from "./format-diary.ts";
import {
  offlineCreateDiaryEntry,
  offlineUpdateDiaryEntry,
  reconcileServerDiaryList,
} from "./offline-store.ts";

function row(id: number, entryAt: string): DiaryEntryRow {
  return {
    id,
    title: `t${id}`,
    summary: "",
    entry_at: entryAt,
    tags: [],
    blocks: [],
    created_at: entryAt,
    updated_at: entryAt,
  };
}

describe("reconcileServerDiaryList", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("保留 outbox 中仍未同步的 temp 条目，避免被服务器列表覆盖丢失", async () => {
    const scope = resolveOutboxScope();
    const tempId = -1;
    await writeOfflineCache(scope, "diary", "list:user", [
      row(tempId, "2026-07-12T00:00:00.000Z"),
      row(10, "2026-07-10T00:00:00.000Z"),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: { subject_kind: "user" },
      tempEntityId: tempId,
      createdAt: "2026-07-12T00:00:00.000Z",
    });

    const serverItems = [row(10, "2026-07-10T00:00:00.000Z")];
    const merged = await reconcileServerDiaryList("user", serverItems);

    expect(merged.map((e) => e.id)).toEqual([tempId, 10]);
  });

  it("temp 条目已同步（outbox 无 create op）时不再保留，直接采用服务器列表", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "diary", "list:user", [row(-1, "2026-07-12T00:00:00.000Z")]);

    const serverItems = [row(11, "2026-07-12T00:00:00.000Z")];
    const merged = await reconcileServerDiaryList("user", serverItems);

    expect(merged.map((e) => e.id)).toEqual([11]);
  });
});

describe("offlineCreateDiaryEntry validation", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("拒绝空标题，避免产生服务端必然拒绝的 outbox op", async () => {
    await expect(
      offlineCreateDiaryEntry("user", {
        title: "   ",
        entry_at: "2026-07-12T00:00:00.000Z",
      }),
    ).rejects.toThrow("diary title is required");
  });

  it("拒绝空 entry_at", async () => {
    await expect(
      offlineCreateDiaryEntry("user", {
        title: "hello",
        entry_at: "  ",
      }),
    ).rejects.toThrow("diary entry_at is required");
  });
});

describe("offlineUpdateDiaryEntry temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("create flush 后本地只剩 server id 时，仍可用 temp id 更新元数据", async () => {
    const scope = resolveOutboxScope();
    const created = await offlineCreateDiaryEntry("user", {
      title: "2026/7/12",
      entry_at: "2026-07-12T12:00:00+08:00",
    });
    expect(created.id).toBeLessThan(0);

    const serverId = 99;
    await setIdMapping(scope, "diary", created.id, serverId);
    await writeOfflineCache(scope, "diary", "list:user", [
      row(serverId, "2026-07-12T12:00:00+08:00"),
    ]);

    const updated = await offlineUpdateDiaryEntry("user", created.id, { tags: ["日常"] });
    expect(updated.id).toBe(serverId);
    expect(updated.tags).toEqual(["日常"]);

    const ops = await listOutboxOps(scope, "diary");
    const patch = ops.find((op) => op.method === "diary.patch");
    expect(patch?.payload.id).toBe(serverId);
  });
});
