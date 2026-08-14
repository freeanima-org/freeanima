import { describe, expect, test } from "bun:test";

import type { TaskListRow } from "./api.ts";
import { LIST_ROOT_DND_ID, listDndId } from "./dnd-ids.ts";
import { resolveFolderDropIntent, resolveListDragEnd } from "./resolve-list-drag-end.ts";

function list(partial: Partial<TaskListRow> & Pick<TaskListRow, "id" | "name">): TaskListRow {
  return {
    sort_order: 0,
    closed: false,
    color: null,
    is_default: false,
    is_folder: false,
    parent_id: null,
    item_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveFolderDropIntent", () => {
  const rect = { top: 100, height: 100 };

  test("上缘 → before", () => {
    expect(resolveFolderDropIntent(rect, 120)).toBe("before");
  });

  test("中间 → into", () => {
    expect(resolveFolderDropIntent(rect, 150)).toBe("into");
  });

  test("下缘 → after", () => {
    expect(resolveFolderDropIntent(rect, 180)).toBe("after");
  });
});

describe("resolveListDragEnd", () => {
  const folder = list({ id: 10, name: "Folder", is_folder: true, sort_order: 0 });
  const child = list({ id: 11, name: "Child", parent_id: 10, sort_order: 0 });
  const sibling = list({ id: 12, name: "Sibling", parent_id: 10, sort_order: 1 });
  const otherFolder = list({ id: 20, name: "Other", is_folder: true, sort_order: 1 });
  const rootList = list({ id: 30, name: "RootList", sort_order: 2 });

  const lists = [folder, child, sibling, otherFolder, rootList];

  test("拖到 list-root → parent_id: null", () => {
    expect(resolveListDragEnd(lists, child.id, LIST_ROOT_DND_ID)).toEqual({
      type: "move",
      listId: child.id,
      parentId: null,
    });
  });

  test("已在根级拖到 list-root → no-op", () => {
    expect(resolveListDragEnd(lists, rootList.id, LIST_ROOT_DND_ID)).toEqual({ type: "noop" });
  });

  test("拖到当前父文件夹中间 → 上移一层（顶级）", () => {
    expect(
      resolveListDragEnd(lists, child.id, listDndId(folder.id), { folderIntent: "into" }),
    ).toEqual({
      type: "move",
      listId: child.id,
      parentId: null,
    });
  });

  test("拖到嵌套父文件夹中间 → 上移到祖父", () => {
    const nestedFolder = list({ id: 13, name: "Nested", is_folder: true, parent_id: 10 });
    const deepChild = list({ id: 14, name: "Deep", parent_id: 13, sort_order: 0 });
    const withNested = [...lists, nestedFolder, deepChild];
    expect(
      resolveListDragEnd(withNested, deepChild.id, listDndId(nestedFolder.id), {
        folderIntent: "into",
      }),
    ).toEqual({
      type: "move",
      listId: deepChild.id,
      parentId: 10,
    });
  });

  test("拖到其它文件夹中间 → 移入", () => {
    expect(
      resolveListDragEnd(lists, child.id, listDndId(otherFolder.id), { folderIntent: "into" }),
    ).toEqual({
      type: "move",
      listId: child.id,
      parentId: otherFolder.id,
    });
  });

  test("根级清单拖到文件夹下缘 → 同级排在文件夹后", () => {
    const action = resolveListDragEnd(lists, rootList.id, listDndId(folder.id), {
      folderIntent: "after",
    });
    expect(action.type).toBe("reorder");
    if (action.type !== "reorder") return;
    expect(action.parentId).toBeNull();
    expect(action.ordered.map((l) => l.id)).toEqual([folder.id, rootList.id, otherFolder.id]);
  });

  test("根级清单拖到文件夹上缘 → 同级排在文件夹前", () => {
    const action = resolveListDragEnd(lists, rootList.id, listDndId(otherFolder.id), {
      folderIntent: "before",
    });
    expect(action.type).toBe("reorder");
    if (action.type !== "reorder") return;
    expect(action.ordered.map((l) => l.id)).toEqual([folder.id, rootList.id, otherFolder.id]);
  });

  test("从文件夹内拖到另一文件夹下缘 → place 到根并排在其后", () => {
    const action = resolveListDragEnd(lists, child.id, listDndId(otherFolder.id), {
      folderIntent: "after",
    });
    expect(action.type).toBe("place");
    if (action.type !== "place") return;
    expect(action.parentId).toBeNull();
    expect(action.ordered.map((l) => l.id)).toEqual([
      folder.id,
      otherFolder.id,
      child.id,
      rootList.id,
    ]);
  });

  test("同级 reorder", () => {
    const action = resolveListDragEnd(lists, child.id, listDndId(sibling.id));
    expect(action.type).toBe("reorder");
    if (action.type !== "reorder") return;
    expect(action.parentId).toBe(10);
    expect(action.ordered.map((l) => l.id)).toEqual([sibling.id, child.id]);
  });

  test("拖到根级清单 → 移到根", () => {
    expect(resolveListDragEnd(lists, child.id, listDndId(rootList.id))).toEqual({
      type: "move",
      listId: child.id,
      parentId: null,
    });
  });

  test("文件夹拖到自身子孙 → no-op", () => {
    const nested = list({ id: 13, name: "NestedFolder", is_folder: true, parent_id: 10 });
    const withNested = [...lists, nested];
    expect(resolveListDragEnd(withNested, folder.id, listDndId(nested.id))).toEqual({
      type: "noop",
    });
  });
});
