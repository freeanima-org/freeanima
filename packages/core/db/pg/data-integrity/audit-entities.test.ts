import { describe, expect, it } from "bun:test";

import { auditEntities, resolveTaskContainer } from "./audit-entities.ts";
import type { EntityIntegritySnapshot } from "./types.ts";

function row(
  partial: Partial<EntityIntegritySnapshot> & Pick<EntityIntegritySnapshot, "id" | "type">,
): EntityIntegritySnapshot {
  return {
    world_id: partial.world_id ?? 1,
    primary_component: partial.primary_component ?? null,
    body: partial.body ?? {},
    deleted_at: partial.deleted_at ?? null,
    ...partial,
  };
}

describe("resolveTaskContainer", () => {
  it("接受仅 list_id 或仅 project_id", () => {
    expect(resolveTaskContainer({ list_id: 10 })).toEqual({ kind: "list", id: 10 });
    expect(resolveTaskContainer({ project_id: 20 })).toEqual({ kind: "project", id: 20 });
  });

  it("两者皆有视为歧义", () => {
    expect(resolveTaskContainer({ list_id: 10, project_id: 20 })).toEqual({
      kind: "ambiguous",
      listId: 10,
      projectId: 20,
    });
  });
});

describe("auditEntities", () => {
  const world = row({
    id: 1,
    type: "world",
    world_id: 1,
    primary_component: "world_config",
    body: { private: true, owner_subject_id: 2 },
  });
  const list = row({
    id: 10,
    type: "content",
    world_id: 1,
    primary_component: "task_list",
    body: { is_default: true },
  });
  const project = row({
    id: 20,
    type: "content",
    world_id: 1,
    primary_component: "project",
    body: {},
  });

  it("项目内 task_item 不按 list 缺失报错", () => {
    const task = row({
      id: 30,
      type: "content",
      world_id: 1,
      primary_component: "task_item",
      body: { project_id: 20, list_id: null },
    });
    const report = auditEntities([world, list, project, task]);
    expect(report.ok).toBe(true);
    expect(report.issue_count).toBe(0);
  });

  it("清单任务仍校验同 world", () => {
    const otherWorld = row({
      id: 2,
      type: "world",
      world_id: 2,
      primary_component: "world_config",
      body: {},
    });
    const task = row({
      id: 31,
      type: "content",
      world_id: 2,
      primary_component: "task_item",
      body: { list_id: 10 },
    });
    const report = auditEntities([world, otherWorld, list, task]);
    expect(report.issues.map((i) => i.code)).toContain("task_item_cross_world");
  });

  it("两者皆无 / 皆有会报错", () => {
    const missing = row({
      id: 32,
      type: "content",
      world_id: 1,
      primary_component: "task_item",
      body: {},
    });
    const both = row({
      id: 33,
      type: "content",
      world_id: 1,
      primary_component: "task_item",
      body: { list_id: 10, project_id: 20 },
    });
    const report = auditEntities([world, list, project, missing, both]);
    expect(report.issues.map((i) => i.code).toSorted()).toEqual([
      "task_item_ambiguous_container",
      "task_item_missing_container",
    ]);
  });

  it("跳过软删实体", () => {
    const orphan = row({
      id: 40,
      type: "content",
      world_id: 999,
      primary_component: "note",
      body: {},
      deleted_at: new Date(),
    });
    const report = auditEntities([world, orphan]);
    expect(report.ok).toBe(true);
  });
});
