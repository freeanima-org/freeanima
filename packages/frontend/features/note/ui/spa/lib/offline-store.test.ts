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
import { resetLocalPreferForTests } from "@freeanima/client/portal-sdk/local-prefer";

import {
  offlineCreateNote,
  offlineUpdateNote,
  offlineUpdateNoteBlock,
  reconcileServerNoteList,
  type NoteRow,
  type NoteTextBlock,
} from "./offline-store.ts";

function textBlock(id: number, parentId: number, content: string, at: string): NoteTextBlock {
  return {
    id,
    title: "",
    content,
    sort_order: 0,
    parent_id: parentId,
    client_op_id: null,
    components: ["content_block"],
    tag_ids: [],
    created_at: at,
    updated_at: at,
  };
}

function row(id: number, at: string, blocks: NoteTextBlock[] = []): NoteRow {
  return {
    id,
    title: `t${id}`,
    summary: "",
    tag_ids: [],
    blocks,
    created_at: at,
    updated_at: at,
  };
}

describe("reconcileServerNoteList", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    resetLocalPreferForTests();
  });

  it("保留 outbox 中仍未同步的 temp 条目，避免被服务器列表覆盖丢失", async () => {
    const scope = resolveOutboxScope();
    const tempId = -1;
    await writeOfflineCache(scope, "note", "list:1", [
      row(tempId, "2026-08-18T00:00:00.000Z"),
      row(10, "2026-08-10T00:00:00.000Z"),
    ]);
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "note",
      method: "note.create",
      payload: { subject_id: 1 },
      tempEntityId: tempId,
      createdAt: "2026-08-18T00:00:00.000Z",
    });

    const serverItems = [row(10, "2026-08-10T00:00:00.000Z")];
    const merged = await reconcileServerNoteList(1, serverItems);

    expect(merged.map((e) => e.id)).toEqual([tempId, 10]);
  });

  it("temp 条目已同步（outbox 无 create op）时不再保留，直接采用服务器列表", async () => {
    const scope = resolveOutboxScope();
    await writeOfflineCache(scope, "note", "list:1", [row(-1, "2026-08-18T00:00:00.000Z")]);

    const serverItems = [row(11, "2026-08-18T00:00:00.000Z")];
    const merged = await reconcileServerNoteList(1, serverItems);

    expect(merged.map((e) => e.id)).toEqual([11]);
  });

  it("note.list 空 blocks 不覆盖本地已缓存的块", async () => {
    const scope = resolveOutboxScope();
    const at = "2026-08-18T00:00:00.000Z";
    const localBlocks = [textBlock(101, 10, "块一", at), textBlock(102, 10, "块二", at)];
    await writeOfflineCache(scope, "note", "list:1", [row(10, at, localBlocks)]);

    const merged = await reconcileServerNoteList(1, [row(10, at)]);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.blocks.map((b) => b.id)).toEqual([101, 102]);
    expect(merged[0]!.blocks.map((b) => b.content)).toEqual(["块一", "块二"]);
  });
});

describe("offlineCreateNote validation", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    resetLocalPreferForTests();
  });

  it("拒绝空标题，避免产生服务端必然拒绝的 outbox op", async () => {
    await expect(offlineCreateNote(1, { title: "   " })).rejects.toThrow("note title is required");
  });
});

describe("offlineUpdateNote temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    resetLocalPreferForTests();
  });

  it("create flush 后本地只剩 server id 时，仍可用 temp id 更新元数据", async () => {
    const scope = resolveOutboxScope();
    const created = await offlineCreateNote(1, { title: "未命名笔记" });
    expect(created.id).toBeLessThan(0);

    const serverId = 99;
    await setIdMapping(scope, "note", created.id, serverId);
    await writeOfflineCache(scope, "note", "list:1", [row(serverId, "2026-08-18T12:00:00.000Z")]);
    await writeOfflineCache(
      scope,
      "note",
      `note:1:${serverId}`,
      row(serverId, "2026-08-18T12:00:00.000Z"),
    );

    const updated = await offlineUpdateNote(1, created.id, { tag_ids: [7] });
    expect(updated.id).toBe(serverId);
    expect(updated.tag_ids).toEqual([7]);

    const ops = await listOutboxOps(scope, "note");
    const patch = ops.find((op) => op.method === "note.patch");
    expect(patch?.payload.id).toBe(serverId);
  });
});

describe("offlineUpdateNoteBlock temp id resolve", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    resetLocalPreferForTests();
  });

  it("blockCreate flush 后本地只剩 server id 时，仍可用 temp id 更新内容", async () => {
    const scope = resolveOutboxScope();
    const at = "2026-08-18T12:00:00.000Z";
    const tempBlockId = -5;
    const serverBlockId = 201;
    const parentId = 10;
    await writeOfflineCache(scope, "note", "list:1", [
      row(parentId, at, [textBlock(serverBlockId, parentId, "旧内容", at)]),
    ]);
    await setIdMapping(scope, "note", tempBlockId, serverBlockId);

    const updated = await offlineUpdateNoteBlock(1, tempBlockId, { content: "新内容" });
    expect(updated.id).toBe(serverBlockId);
    expect(updated.content).toBe("新内容");

    const ops = await listOutboxOps(scope, "note");
    const patch = ops.find((op) => op.method === "note.blockPatch");
    expect(patch?.payload.id).toBe(serverBlockId);
  });
});
