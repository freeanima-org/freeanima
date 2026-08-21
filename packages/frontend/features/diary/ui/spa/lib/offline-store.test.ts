import { beforeEach, describe, expect, it } from "bun:test";

import { writeOfflineCache } from "@freeanima/client/portal-sdk/offline-cache";
import { setIdMapping } from "@freeanima/client/portal-sdk/offline-id-map";
import {
  enqueueOutboxOp,
  listOutboxOps,
  resolveOutboxScope,
  setOfflineOutboxBackendForTests,
} from "@freeanima/client/portal-sdk/offline-outbox";
import { resetOfflineModuleRegistryForTests } from "@freeanima/client/portal-sdk/offline-module-registry";
import { resetTempIdAllocatorForTests } from "@freeanima/client/portal-sdk/offline-temp-id";

import type { DiaryEntryRow, DiaryTextBlock } from "./format-diary.ts";
import {
  offlineCreateDiaryEntry,
  offlineUpdateDiaryBlock,
  offlineUpdateDiaryEntry,
  reconcileServerDiaryList,
} from "./offline-store.ts";

function textBlock(id: number, parentId: number, content: string, entryAt: string): DiaryTextBlock {
  return {
    id,
    title: "",
    content,
    sort_order: 0,
    parent_id: parentId,
    client_op_id: null,
    components: ["content_block"],
    tag_ids: [],
    created_at: entryAt,
    updated_at: entryAt,
  };
}

function row(id: number, entryAt: string, blocks: DiaryTextBlock[] = []): DiaryEntryRow {
  return {
    id,
    title: `t${id}`,
    summary: "",
    entry_at: entryAt,
    tag_ids: [],
    blocks,
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
    await writeOfflineCache(scope, "diary", "list:1", [
      row(tempId, "2026-07-12T00:00:00.000Z"),
      row(10, "2026-07-10T00:00:00.000Z"),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: { subject_id: 1 },
      tempEntityId: tempId,
      createdAt: "2026-07-12T00:00:00.000Z",
    });

    const serverItems = [row(10, "2026-07-10T00:00:00.000Z")];
    const merged = await reconcileServerDiaryList(1, serverItems);

    expect(merged.map((e) => e.id)).toEqual([tempId, 10]);
  });

  it("temp 条目已同步（outbox 无 create op）时不再保留，直接采用服务器列表", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "diary", "list:1", [row(-1, "2026-07-12T00:00:00.000Z")]);

    const serverItems = [row(11, "2026-07-12T00:00:00.000Z")];
    const merged = await reconcileServerDiaryList(1, serverItems);

    expect(merged.map((e) => e.id)).toEqual([11]);
  });

  it("diary.list 空 blocks 不覆盖本地已缓存的块", async () => {
    const scope = resolveOutboxScope();
    const entryAt = "2026-07-12T00:00:00.000Z";
    const localBlocks = [textBlock(101, 10, "块一", entryAt), textBlock(102, 10, "块二", entryAt)];
    await writeOfflineCache(scope, "diary", "list:1", [row(10, entryAt, localBlocks)]);

    const merged = await reconcileServerDiaryList(1, [row(10, entryAt)]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.blocks.map((b) => b.id)).toEqual([101, 102]);
    expect(merged[0]!.blocks.map((b) => b.content)).toEqual(["块一", "块二"]);
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
      offlineCreateDiaryEntry(1, {
        title: "   ",
        entry_at: "2026-07-12T00:00:00.000Z",
      }),
    ).rejects.toThrow("diary title is required");
  });

  it("拒绝空 entry_at", async () => {
    await expect(
      offlineCreateDiaryEntry(1, {
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
    const created = await offlineCreateDiaryEntry(1, {
      title: "2026/7/12",
      entry_at: "2026-07-12T12:00:00+08:00",
    });
    expect(created.id).toBeLessThan(0);

    const serverId = 99;
    await setIdMapping(scope, "diary", created.id, serverId);
    await writeOfflineCache(scope, "diary", "list:1", [row(serverId, "2026-07-12T12:00:00+08:00")]);

    const updated = await offlineUpdateDiaryEntry(1, created.id, { tag_ids: [7] });
    expect(updated.id).toBe(serverId);
    expect(updated.tag_ids).toEqual([7]);

    const ops = await listOutboxOps(scope, "diary");
    const patch = ops.find((op) => op.method === "diary.patch");
    expect(patch?.payload.id).toBe(serverId);
  });
});

describe("offlineUpdateDiaryBlock temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
  });

  it("blockCreate flush 后本地只剩 server id 时，仍可用 temp id 更新内容", async () => {
    const scope = resolveOutboxScope();
    const entryAt = "2026-07-12T12:00:00+08:00";
    const tempBlockId = -5;
    const serverBlockId = 201;
    const parentId = 10;
    await writeOfflineCache(scope, "diary", "list:1", [
      row(parentId, entryAt, [textBlock(serverBlockId, parentId, "旧内容", entryAt)]),
    ]);
    await setIdMapping(scope, "diary", tempBlockId, serverBlockId);

    const updated = await offlineUpdateDiaryBlock(1, tempBlockId, { content: "新内容" });
    expect(updated.id).toBe(serverBlockId);
    expect(updated.content).toBe("新内容");

    const ops = await listOutboxOps(scope, "diary");
    const patch = ops.find((op) => op.method === "diary.blockPatch");
    expect(patch?.payload.id).toBe(serverBlockId);
  });
});
