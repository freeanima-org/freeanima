#!/usr/bin/env bun
/**
 * 一次性迁移：旧 `tasks` 表 → entity `task_item`（默认清单 id=2）。
 *
 *   DATABASE_URL=postgres://… bun scripts/migrate-tasks-to-entities.ts
 *   DATABASE_URL=postgres://… bun scripts/migrate-tasks-to-entities.ts --dry-run
 *
 * 在应用 DROP tasks 迁移之前运行；可重复执行（按 legacy tag 去重）。
 */

import { SQL } from "bun";

import type { RuntimeConfig } from "@freeanima/habitat/core/config/schemas/runtime-config.ts";
import { bindResolvedWorldContext } from "@freeanima/habitat/core/config/world-context.ts";
import { ensureWorldSubjects } from "@freeanima/habitat/core/db/pg/entity/subject-world.ts";
import {
  createTaskItem,
  getDefaultTaskList,
  listTaskItems,
  updateTaskItem,
} from "@freeanima/features/task/domain/index.ts";
import { initDatabase } from "@freeanima/habitat/core/db/pg/index.ts";

const MINIMAL_CONFIG = {
  llm: { default_profile: "chat", providers: {}, profiles: {} },
} as RuntimeConfig;

async function resolveUserTaskWorldId(): Promise<number> {
  const ctx = await ensureWorldSubjects(MINIMAL_CONFIG);
  bindResolvedWorldContext(ctx);
  return ctx.user_world_id;
}

type LegacyTaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  completed_at: string | null;
};

const VALID_PRIORITIES = new Set(["high", "medium", "low", "none"]);

function legacyTag(id: string): string {
  return `legacy:${id}`;
}

function mapStatus(raw: string): "pending" | "completed" | "skip" {
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "skip";
  return "pending";
}

function mapPriority(raw: string): "high" | "medium" | "low" | "none" {
  return VALID_PRIORITIES.has(raw) ? (raw as "high" | "medium" | "low" | "none") : "none";
}

async function tableExists(sql: SQL): Promise<boolean> {
  const rows = (await sql`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tasks'
    ) AS "exists"
  `) as Array<{ exists: boolean }>;
  return Boolean(rows[0]?.exists);
}

async function loadLegacyTasks(sql: SQL): Promise<LegacyTaskRow[]> {
  return (await sql`
    SELECT id, title, description, status, priority, due_at, completed_at
    FROM tasks
    ORDER BY created_at ASC
  `) as LegacyTaskRow[];
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const sql = new SQL(url);
  const { closeDb } = await import("@freeanima/habitat/core/db/pg/index.ts");
  initDatabase({ getDatabaseUrl: () => url });

  try {
    if (!(await tableExists(sql))) {
      console.log("tasks table not found — nothing to migrate");
      return;
    }

    const legacyRows = await loadLegacyTasks(sql);
    if (legacyRows.length === 0) {
      console.log("tasks table is empty — nothing to migrate");
      return;
    }

    const worldId = await resolveUserTaskWorldId();
    const defaultList = await getDefaultTaskList(worldId);

    const existing = await listTaskItems(worldId, { status: "all", limit: 5000 });
    // 旧版用 body.tags 里的 legacy:<id> 去重；任务已改 tag_ids，归档脚本不再依赖字符串标签
    const migrated = new Set(existing.map((item) => String(item.id)));

    let created = 0;
    let skipped = 0;

    for (const row of legacyRows) {
      if (migrated.has(row.id)) {
        skipped++;
        continue;
      }

      const status = mapStatus(row.status);
      if (status === "skip") {
        skipped++;
        continue;
      }

      const payload = {
        title: row.title.trim() || "(无标题)",
        content: row.description?.trim() ?? "",
        tags: [legacyTag(row.id)],
        list_id: defaultList.id,
        priority: mapPriority(row.priority),
        due_at: row.due_at,
      };

      if (dryRun) {
        console.log("[dry-run] would migrate", row.id, "→", payload.title);
        created++;
        continue;
      }

      const item = await createTaskItem(worldId, payload);
      if (status === "completed") {
        await updateTaskItem(worldId, {
          id: item.id,
          status: "completed",
        });
      }
      created++;
    }

    console.log(
      `migration done: ${created} created, ${skipped} skipped (${legacyRows.length} legacy rows)`,
    );
  } finally {
    await closeDb();
    void sql.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
