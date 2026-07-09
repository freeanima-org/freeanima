#!/usr/bin/env bun
/**
 * 从 PG messages 中 task_list / task_create / task_get 工具结果汇总去重，恢复为 entity task_item。
 *
 *   bun scripts/recover-tasks-from-message-history.ts
 *   bun scripts/recover-tasks-from-message-history.ts --dry-run
 *
 * 按 legacy:<uuid> 去重；已存在的跳过。多次快照保留 updated_at 最新的一条。
 */

import { SQL } from "bun";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AnimaConfig } from "@freeanima/core/config/schemas/config.ts";
import { bindResolvedWorldContext } from "@freeanima/core/config/world-context.ts";
import { ensureWorldSubjects } from "@freeanima/core/db/pg/entity/subject-world.ts";
import {
  createTaskItem,
  getDefaultTaskList,
  listTaskItems,
  updateTaskItem,
} from "@freeanima/features/task/domain/index.ts";
import { initDatabase } from "@freeanima/core/db/pg/index.ts";

const MINIMAL_CONFIG = {
  llm: { default_profile: "chat", providers: {}, profiles: {} },
} as AnimaConfig;

async function resolveUserTaskWorldId(): Promise<number> {
  const ctx = await ensureWorldSubjects(MINIMAL_CONFIG);
  bindResolvedWorldContext(ctx);
  return ctx.user_world_id;
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

type LegacyTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
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

function parseTask(raw: Record<string, unknown>): LegacyTask | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  const title = typeof raw.title === "string" ? raw.title : "";
  if (!id || !title.trim()) return null;
  return {
    id,
    title,
    description: typeof raw.description === "string" ? raw.description : null,
    status: typeof raw.status === "string" ? raw.status : "pending",
    priority: typeof raw.priority === "string" ? raw.priority : "none",
    due_at: typeof raw.due_at === "string" ? raw.due_at : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    completed_at: typeof raw.completed_at === "string" ? raw.completed_at : null,
  };
}

function extractTasksFromPayload(content: string, toolName: string): LegacyTask[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];

  const obj = parsed as Record<string, unknown>;
  const out: LegacyTask[] = [];

  if (toolName === "task_list" && Array.isArray(obj.tasks)) {
    for (const row of obj.tasks) {
      if (row && typeof row === "object") {
        const task = parseTask(row as Record<string, unknown>);
        if (task) out.push(task);
      }
    }
    return out;
  }

  if (
    (toolName === "task_create" || toolName === "task_get") &&
    obj.task &&
    typeof obj.task === "object"
  ) {
    const task = parseTask(obj.task as Record<string, unknown>);
    if (task) out.push(task);
  }

  return out;
}

function isNewer(a: LegacyTask, b: LegacyTask): boolean {
  const au = a.updated_at ? Date.parse(a.updated_at) : 0;
  const bu = b.updated_at ? Date.parse(b.updated_at) : 0;
  if (au !== bu) return au > bu;
  const ac = a.created_at ? Date.parse(a.created_at) : 0;
  const bc = b.created_at ? Date.parse(b.created_at) : 0;
  return ac >= bc;
}

async function loadToolMessages(
  sql: SQL,
): Promise<{ tool: string; conversation_id: string; pos: number; content: string }[]> {
  return (await sql`
    SELECT
      payload->>'name' AS tool,
      conversation_id,
      pos::int AS pos,
      payload->>'content' AS content
    FROM messages
    WHERE payload->>'role' = 'tool'
      AND payload->>'name' IN ('task_list', 'task_create', 'task_get')
      AND payload->>'content' IS NOT NULL
    ORDER BY conversation_id ASC, pos ASC
  `) as { tool: string; conversation_id: string; pos: number; content: string }[];
}

function mergeTasks(
  rows: { tool: string; conversation_id: string; pos: number; content: string }[],
): LegacyTask[] {
  const byId = new Map<string, LegacyTask>();

  for (const row of rows) {
    const tasks = extractTasksFromPayload(row.content, row.tool);
    for (const task of tasks) {
      const existing = byId.get(task.id);
      if (!existing || isNewer(task, existing)) {
        byId.set(task.id, task);
      }
    }
  }

  return [...byId.values()].toSorted((a, b) => {
    const ta = a.updated_at ?? a.created_at ?? "";
    const tb = b.updated_at ?? b.created_at ?? "";
    return ta.localeCompare(tb) || a.title.localeCompare(b.title);
  });
}

async function resolveDatabaseUrl(): Promise<string> {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv) return fromEnv;

  const { FileConfig, getConfiguredDatabaseUrl } = await import(
    join(repoRoot, "src/platform/config/index.ts")
  );
  const cfg = FileConfig.open();
  const url = await getConfiguredDatabaseUrl(cfg.data);
  if (!url) throw new Error("DATABASE_URL or anima database.url required");
  return url;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const url = await resolveDatabaseUrl();

  const sql = new SQL(url);
  const { closeDb } = await import("@freeanima/core/db/pg/index.ts");
  initDatabase({ getDatabaseUrl: () => url });

  try {
    const toolRows = await loadToolMessages(sql);
    const merged = mergeTasks(toolRows);

    if (merged.length === 0) {
      console.log("no legacy tasks found in message history");
      return;
    }

    const worldId = await resolveUserTaskWorldId();
    const defaultList = await getDefaultTaskList(worldId);

    const existing = await listTaskItems(worldId, { status: "all", limit: 5000 });
    const migrated = new Set(
      existing.flatMap((item) =>
        item.tags.filter((t) => t.startsWith("legacy:")).map((t) => t.slice("legacy:".length)),
      ),
    );

    let created = 0;
    let skipped = 0;

    console.log(`merged ${merged.length} unique tasks from ${toolRows.length} tool messages`);

    for (const row of merged) {
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
        title: row.title.trim(),
        content: row.description?.trim() ?? "",
        tags: [legacyTag(row.id)],
        list_id: defaultList.id,
        priority: mapPriority(row.priority),
        due_at: row.due_at,
      };

      if (dryRun) {
        console.log(`[dry-run] ${row.id.slice(0, 8)}… ${status} ${payload.title}`);
        created++;
        continue;
      }

      const item = await createTaskItem(worldId, payload);
      if (status === "completed") {
        await updateTaskItem(worldId, { id: item.id, status: "completed" });
      }
      console.log(`+ ${item.id} ← ${row.id.slice(0, 8)}… ${payload.title}`);
      created++;
    }

    console.log(`recovery done: ${created} created, ${skipped} skipped`);
  } finally {
    await closeDb();
    void sql.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
