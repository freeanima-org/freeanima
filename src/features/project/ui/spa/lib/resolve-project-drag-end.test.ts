import { describe, expect, test } from "bun:test";

import type { ProjectFolderRow, ProjectRow } from "./api.ts";
import { PROJECT_ROOT_DND_ID, projectFolderDndId, projectItemDndId } from "./project-dnd-ids.ts";
import { resolveFolderDropIntent, resolveProjectDragEnd } from "./resolve-project-drag-end.ts";

function folder(
  partial: Partial<ProjectFolderRow> & Pick<ProjectFolderRow, "id" | "name">,
): ProjectFolderRow {
  return {
    parent_id: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function project(partial: Partial<ProjectRow> & Pick<ProjectRow, "id" | "title">): ProjectRow {
  return {
    content: "",
    folder_id: null,
    sort_order: 0,
    status: "active",
    start_at: "2026-01-01T00:00:00.000Z",
    end_at: "2026-12-31T00:00:00.000Z",
    completion_criteria: "",
    product_tag: null,
    linked_diary_ids: [],
    task_count: 0,
    milestone_count: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("resolveFolderDropIntent", () => {
  const rect = { top: 100, height: 100 };

  test("下缘 → after", () => {
    expect(resolveFolderDropIntent(rect, 180)).toBe("after");
  });
});

describe("resolveProjectDragEnd", () => {
  const f1 = folder({ id: 10, name: "A", sort_order: 0 });
  const f2 = folder({ id: 20, name: "B", sort_order: 1 });
  const nested = folder({ id: 11, name: "Nested", parent_id: 10, sort_order: 0 });
  const pRoot = project({ id: 30, title: "RootP", sort_order: 0 });
  const pInA = project({ id: 31, title: "InA", folder_id: 10, sort_order: 0 });

  const folders = [f1, f2, nested];
  const projects = [pRoot, pInA];

  test("项目拖到 project-root → folder_id null", () => {
    expect(
      resolveProjectDragEnd(folders, projects, projectItemDndId(pInA.id), PROJECT_ROOT_DND_ID),
    ).toEqual({
      type: "moveProject",
      projectId: pInA.id,
      folderId: null,
    });
  });

  test("项目拖到文件夹中间 → 移入", () => {
    expect(
      resolveProjectDragEnd(
        folders,
        projects,
        projectItemDndId(pRoot.id),
        projectFolderDndId(f1.id),
        { folderIntent: "into" },
      ),
    ).toEqual({
      type: "moveProject",
      projectId: pRoot.id,
      folderId: f1.id,
    });
  });

  test("根级项目拖到文件夹下缘 → 仍在根并排顺序", () => {
    const action = resolveProjectDragEnd(
      folders,
      projects,
      projectItemDndId(pRoot.id),
      projectFolderDndId(f1.id),
      { folderIntent: "after" },
    );
    expect(action.type).toBe("reorderProjects");
    if (action.type !== "reorderProjects") return;
    expect(action.folderId).toBeNull();
    expect(action.ordered.map((p) => p.id)).toEqual([pRoot.id]);
  });

  test("文件夹拖到另一文件夹下缘 → 同级排在其后", () => {
    const action = resolveProjectDragEnd(
      folders,
      projects,
      projectFolderDndId(f2.id),
      projectFolderDndId(f1.id),
      { folderIntent: "after" },
    );
    expect(action.type).toBe("reorderFolders");
    if (action.type !== "reorderFolders") return;
    expect(action.ordered.map((f) => f.id)).toEqual([f1.id, f2.id]);
  });

  test("嵌套文件夹拖到父文件夹中间 → 上移到顶级", () => {
    expect(
      resolveProjectDragEnd(
        folders,
        projects,
        projectFolderDndId(nested.id),
        projectFolderDndId(f1.id),
        { folderIntent: "into" },
      ),
    ).toEqual({
      type: "moveFolder",
      folderId: nested.id,
      parentId: null,
    });
  });

  test("项目拖到另一项目后 → reorder", () => {
    const p2 = project({ id: 32, title: "P2", sort_order: 1 });
    const withTwo = [pRoot, p2];
    const action = resolveProjectDragEnd(
      folders,
      withTwo,
      projectItemDndId(pRoot.id),
      projectItemDndId(p2.id),
      { projectIntent: "after" },
    );
    expect(action.type).toBe("reorderProjects");
    if (action.type !== "reorderProjects") return;
    expect(action.ordered.map((p) => p.id)).toEqual([p2.id, pRoot.id]);
  });
});
