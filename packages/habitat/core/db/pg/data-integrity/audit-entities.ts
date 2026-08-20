import {
  PROJECT_COMPONENT,
  TASK_ITEM_COMPONENT,
  TASK_LIST_COMPONENT,
} from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
import {
  subjectConfigBodySchema,
  worldConfigBodySchema,
} from "@freeanima/habitat/core/db/schema/entity/index.ts";

import type {
  ConfiguredSubjects,
  DataIntegrityIssue,
  DataIntegrityReport,
  EntityIntegritySnapshot,
} from "./types.ts";

function positiveId(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isLive(row: EntityIntegritySnapshot): boolean {
  return row.deleted_at == null;
}

type TaskContainer =
  | { kind: "list"; id: number }
  | { kind: "project"; id: number }
  | { kind: "missing" }
  | { kind: "ambiguous"; listId: number; projectId: number }
  | { kind: "invalid" };

/** 与 task_item body 约定一致：list_id XOR project_id；两者皆有视为歧义 */
export function resolveTaskContainer(body: Record<string, unknown> | null): TaskContainer {
  const listId = positiveId(body?.list_id);
  const projectId = positiveId(body?.project_id);
  if (listId != null && projectId != null) {
    return { kind: "ambiguous", listId, projectId };
  }
  if (projectId != null) return { kind: "project", id: projectId };
  if (listId != null) return { kind: "list", id: listId };
  if (body?.list_id != null || body?.project_id != null) return { kind: "invalid" };
  return { kind: "missing" };
}

function pushSubjectChecks(
  issues: DataIntegrityIssue[],
  byId: Map<number, EntityIntegritySnapshot>,
  configured: ConfiguredSubjects,
): void {
  for (const [label, subjectId] of [
    ["user", configured.user_subject_id],
    ["agent", configured.agent_subject_id],
  ] as const) {
    if (subjectId == null) continue;
    const subject = byId.get(subjectId);
    if (!subject || !isLive(subject)) {
      issues.push({
        code: "missing_configured_subject",
        message: `configured ${label}_subject_id=${subjectId} not found`,
      });
      continue;
    }
    const expectedType = label === "user" ? "user" : "agent";
    if (subject.type !== expectedType) {
      issues.push({
        code: "subject_type_mismatch",
        message: `configured ${label}_subject_id=${subjectId} has type=${subject.type}`,
        entity_id: subjectId,
      });
    }
    const parsed = subjectConfigBodySchema.safeParse(subject.body);
    const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
    if (worldId == null) {
      issues.push({
        code: "subject_missing_private_world",
        message: `${label} subject ${subjectId} has no default_private_world_id`,
        entity_id: subjectId,
      });
      continue;
    }
    const world = byId.get(worldId);
    if (!world || world.type !== "world" || !isLive(world)) {
      issues.push({
        code: "subject_invalid_private_world",
        message: `${label} subject ${subjectId} default_private_world_id=${worldId} invalid`,
        entity_id: subjectId,
      });
      continue;
    }
    const worldBody = worldConfigBodySchema.safeParse(world.body);
    if (
      !worldBody.success ||
      !worldBody.data.private ||
      worldBody.data.owner_subject_id !== subjectId
    ) {
      issues.push({
        code: "subject_world_owner_mismatch",
        message: `${label} subject ${subjectId} private world ${worldId} owner mismatch`,
        entity_id: subjectId,
      });
    }
  }
}

function pushDuplicateDefaultInbox(
  issues: DataIntegrityIssue[],
  rows: EntityIntegritySnapshot[],
): void {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (!isLive(row) || row.primary_component !== TASK_LIST_COMPONENT) continue;
    if (row.body?.is_default !== true) continue;
    counts.set(row.world_id, (counts.get(row.world_id) ?? 0) + 1);
  }
  for (const [worldId, cnt] of counts) {
    if (cnt <= 1) continue;
    issues.push({
      code: "duplicate_default_inbox",
      message: `world_id=${worldId} has ${cnt} default task lists`,
    });
  }
}

/**
 * 纯函数：对实体快照做通用数据完整性审计。
 * 覆盖：world 引用、task_item 清单/项目归属、配置主体私有 world、重复默认收件箱。
 */
export function auditEntities(
  rows: EntityIntegritySnapshot[],
  opts?: {
    configuredSubjects?: ConfiguredSubjects;
    issueLimit?: number;
  },
): DataIntegrityReport {
  const issues: DataIntegrityIssue[] = [];
  const byId = new Map(rows.map((r) => [r.id, r]));
  const issueLimit =
    opts?.issueLimit != null && opts.issueLimit > 0 ? opts.issueLimit : Number.POSITIVE_INFINITY;

  for (const row of rows) {
    if (!isLive(row)) continue;
    if (row.type === "world" || row.type === "agent" || row.type === "user") continue;
    const world = byId.get(row.world_id);
    if (!world || world.type !== "world" || !isLive(world)) {
      issues.push({
        code: "invalid_world_ref",
        message: `content ${row.id} references missing or non-world world_id=${row.world_id}`,
        entity_id: row.id,
      });
    }
  }

  for (const row of rows) {
    if (!isLive(row) || row.primary_component !== TASK_ITEM_COMPONENT) continue;
    const container = resolveTaskContainer(row.body);
    if (container.kind === "missing") {
      issues.push({
        code: "task_item_missing_container",
        message: `task_item ${row.id} has neither list_id nor project_id`,
        entity_id: row.id,
      });
      continue;
    }
    if (container.kind === "invalid") {
      issues.push({
        code: "task_item_invalid_container",
        message: `task_item ${row.id} has invalid list_id/project_id`,
        entity_id: row.id,
      });
      continue;
    }
    if (container.kind === "ambiguous") {
      issues.push({
        code: "task_item_ambiguous_container",
        message: `task_item ${row.id} has both list_id=${container.listId} and project_id=${container.projectId}`,
        entity_id: row.id,
      });
      continue;
    }

    const target = byId.get(container.id);
    const expectedPrimary = container.kind === "list" ? TASK_LIST_COMPONENT : PROJECT_COMPONENT;
    const label = container.kind === "list" ? "list" : "project";
    if (!target || !isLive(target)) {
      issues.push({
        code: "task_item_orphan_container",
        message: `task_item ${row.id} ${label}_id=${container.id} not found`,
        entity_id: row.id,
      });
      continue;
    }
    if (target.primary_component !== expectedPrimary) {
      issues.push({
        code: "task_item_container_type_mismatch",
        message: `task_item ${row.id} ${label}_id=${container.id} primary_component=${target.primary_component ?? "null"}`,
        entity_id: row.id,
      });
      continue;
    }
    if (container.kind === "list" && target.body?.is_folder === true) {
      issues.push({
        code: "task_item_list_is_folder",
        message: `task_item ${row.id} list_id=${container.id} points to a folder`,
        entity_id: row.id,
      });
      continue;
    }
    if (target.world_id !== row.world_id) {
      issues.push({
        code: "task_item_cross_world",
        message: `task_item ${row.id} world_id=${row.world_id} !== ${label} ${container.id} world_id=${target.world_id}`,
        entity_id: row.id,
      });
    }
  }

  if (opts?.configuredSubjects) {
    pushSubjectChecks(issues, byId, opts.configuredSubjects);
  }
  pushDuplicateDefaultInbox(issues, rows);

  const truncated = issues.length > issueLimit;
  const limited = truncated ? issues.slice(0, issueLimit) : issues;
  return {
    ok: issues.length === 0,
    entity_count: rows.length,
    issue_count: issues.length,
    truncated,
    issues: limited,
  };
}
