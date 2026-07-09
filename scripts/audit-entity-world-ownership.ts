#!/usr/bin/env bun
/**
 * 只读校验：实体 world 归属与 subject 默认私有 world 一致性。
 * 用法：DATABASE_URL=… bun scripts/audit-entity-world-ownership.ts
 */
import { SQL } from "bun";

import { resolveWorldSubjectIds } from "@freeanima/core/config/worlds.ts";
import { initDatabase } from "@freeanima/core/db/pg/index.ts";
import {
  subjectConfigBodySchema,
  worldConfigBodySchema,
} from "@freeanima/core/db/schema/entity/index.ts";
import { RuntimeConfigStore } from "@freeanima/platform/config/runtime-config-store.ts";

type EntityRow = {
  id: number;
  type: string;
  world_id: number;
  primary_component: string;
  body: Record<string, unknown> | null;
};

type Issue = { code: string; message: string; entity_id?: number };

function fail(issues: Issue[]): never {
  for (const issue of issues) {
    console.error(
      `[${issue.code}] ${issue.message}${issue.entity_id != null ? ` (entity ${issue.entity_id})` : ""}`,
    );
  }
  process.exit(1);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  initDatabase({ getDatabaseUrl: () => url });
  const sql = new SQL(url);

  const issues: Issue[] = [];
  const rows = (await sql`
    SELECT id, type, world_id, primary_component, body
    FROM entities
  `) as EntityRow[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  for (const row of rows) {
    if (row.type === "world" || row.type === "agent" || row.type === "user") continue;
    const world = byId.get(row.world_id);
    if (!world || world.type !== "world") {
      issues.push({
        code: "invalid_world_ref",
        message: `content ${row.id} references missing or non-world world_id=${row.world_id}`,
        entity_id: row.id,
      });
    }
  }

  for (const row of rows) {
    if (row.primary_component !== "task_item") continue;
    const listId = Number(row.body?.list_id);
    if (!Number.isFinite(listId) || listId <= 0) {
      issues.push({
        code: "task_item_missing_list",
        message: `task_item ${row.id} has invalid list_id`,
        entity_id: row.id,
      });
      continue;
    }
    const list = byId.get(listId);
    if (!list) {
      issues.push({
        code: "task_item_orphan_list",
        message: `task_item ${row.id} list_id=${listId} not found`,
        entity_id: row.id,
      });
      continue;
    }
    if (list.world_id !== row.world_id) {
      issues.push({
        code: "task_item_cross_world",
        message: `task_item ${row.id} world_id=${row.world_id} !== list ${listId} world_id=${list.world_id}`,
        entity_id: row.id,
      });
    }
  }

  let runtime;
  try {
    runtime = (await RuntimeConfigStore.open()).data;
  } catch {
    runtime = undefined;
  }

  if (runtime) {
    const { user_subject_id, agent_subject_id } = resolveWorldSubjectIds(runtime);
    for (const [label, subjectId] of [
      ["user", user_subject_id],
      ["agent", agent_subject_id],
    ] as const) {
      const subject = byId.get(subjectId);
      if (!subject) {
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
      if (!world || world.type !== "world") {
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

  const dupDefaultLists = (await sql`
    SELECT world_id, COUNT(*)::text AS cnt
    FROM entities
    WHERE primary_component = 'task_list'
      AND COALESCE(body->>'is_default', 'false') = 'true'
    GROUP BY world_id
    HAVING COUNT(*) > 1
  `) as { world_id: number; cnt: string }[];

  for (const row of dupDefaultLists) {
    issues.push({
      code: "duplicate_default_inbox",
      message: `world_id=${row.world_id} has ${row.cnt} default task lists`,
    });
  }

  void sql.close();

  if (issues.length > 0) fail(issues);

  console.log(`audit ok (${rows.length} entities)`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
