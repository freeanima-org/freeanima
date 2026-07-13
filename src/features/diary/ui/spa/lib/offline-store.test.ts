import { beforeEach, describe, expect, it } from "bun:test";

import { writeOfflineCache } from "@freeanima/frontend/shell-sdk/offline-cache";
import {
  enqueueOutboxOp,
  resolveOutboxScope,
  setOfflineOutboxBackendForTests,
} from "@freeanima/frontend/shell-sdk/offline-outbox";
import { resetOfflineModuleRegistryForTests } from "@freeanima/frontend/shell-sdk/offline-module-registry";

import type { DiaryEntryRow } from "./format-diary.ts";
import { offlineCreateDiaryEntry, reconcileServerDiaryList } from "./offline-store.ts";

function row(id: number, entryAt: string): DiaryEntryRow {
  return {
    id,
    title: `t${id}`,
    content: "",
    summary: "",
    entry_at: entryAt,
    tags: [],
    created_at: entryAt,
    updated_at: entryAt,
  };
}

describe("reconcileServerDiaryList", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
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
