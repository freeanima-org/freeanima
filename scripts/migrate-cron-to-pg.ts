#!/usr/bin/env bun
/**
 * 一次性迁移：~/.anima/cron/jobs.json → PG cron_jobs 表。
 *
 * 用法：
 *   DATABASE_URL="$(anima credential get services/postgres/anima url)" \
 *     bun run scripts/migrate-cron-to-pg.ts [--dry-run] [--home ~/.anima]
 */
import { execSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  writeFileSync as writeOut,
} from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { cronJobsFileSchema } from "../connectors/cron/src/schema.ts";

type Args = {
  dryRun: boolean;
  home: string;
  databaseUrl: string;
};

function parseArgs(argv: string[]): Args {
  let dryRun = false;
  let home = process.env.FREEANIMA_HOME ?? join(homedir(), ".anima");
  let databaseUrl = process.env.DATABASE_URL ?? "";

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--home") home = argv[++i] ?? home;
    else if (arg === "--database-url") databaseUrl = argv[++i] ?? databaseUrl;
  }

  if (!databaseUrl) {
    throw new Error("需要 DATABASE_URL 环境变量或 --database-url 参数");
  }

  return { dryRun, home, databaseUrl };
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlTextArray(values: string[]): string {
  if (!values.length) return "'{}'::text[]";
  return `ARRAY[${values.map((v) => sqlLiteral(v)).join(", ")}]::text[]`;
}

function unixToTimestamptz(ts: number): string | null {
  if (!ts || ts <= 0) return null;
  return new Date(ts * 1000).toISOString();
}

function isoToTimestamptz(iso: string): string {
  if (!iso) return new Date().toISOString();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const jobsFile = join(args.home, "cron", "jobs.json");

  console.log(`扫描文件: ${jobsFile}`);
  if (!existsSync(jobsFile)) {
    console.log("未发现 jobs.json，无需迁移");
    return;
  }

  const raw: unknown = JSON.parse(readFileSync(jobsFile, "utf-8"));
  const parsed = cronJobsFileSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`jobs.json 格式无效: ${parsed.error.message}`);
  }

  console.log(`发现 ${parsed.data.length} 条任务`);
  if (args.dryRun) console.log("（dry-run 模式，不写入数据库）");

  const statements: string[] = [];
  let migrated = 0;
  let skipped = 0;

  for (const item of parsed.data) {
    let lastOutputRef = item.last_output_ref ?? null;

    if (!lastOutputRef && item.last_output) {
      const runNum = item.run_count > 0 ? item.run_count : 1;
      const absOut = join(
        args.home,
        "cron",
        "output",
        `${item.id}-${String(runNum).padStart(4, "0")}.txt`,
      );
      mkdirSync(join(args.home, "cron", "output"), { recursive: true });
      const content = item.last_output.slice(0, 10_000);
      if (!args.dryRun) {
        writeOut(absOut, content, "utf-8");
      }
      lastOutputRef = relative(args.home, absOut).replace(/\\/g, "/");
    }

    if (args.dryRun) {
      console.log(`[dry-run] ${item.id} ${item.name} schedule=${item.schedule}`);
      migrated++;
      continue;
    }

    statements.push(`
INSERT INTO cron_jobs (
  id, name, schedule, prompt, skills, script, no_agent, enabled_toolsets,
  model_provider, model_name, workdir, context_from, deliver, timeout_sec,
  builtin, repeat, run_count, paused, created_at, updated_at, last_run_at, last_output_ref
) VALUES (
  ${sqlLiteral(item.id)},
  ${sqlLiteral(item.name)},
  ${sqlLiteral(item.schedule)},
  ${sqlLiteral(item.prompt ?? "")},
  ${sqlTextArray(item.skills ?? [])},
  ${item.script != null ? sqlLiteral(item.script) : "NULL"},
  ${item.no_agent ?? false},
  ${item.enabled_toolsets != null ? sqlTextArray(item.enabled_toolsets) : "NULL"},
  ${item.model_provider != null ? sqlLiteral(item.model_provider) : "NULL"},
  ${item.model_name != null ? sqlLiteral(item.model_name) : "NULL"},
  ${item.workdir != null ? sqlLiteral(item.workdir) : "NULL"},
  ${sqlTextArray(item.context_from ?? [])},
  ${sqlLiteral(item.deliver ?? "local")},
  ${item.timeout_sec ?? 300},
  ${item.builtin ?? false},
  ${item.repeat ?? null},
  ${item.run_count ?? 0},
  ${item.paused ?? false},
  ${sqlLiteral(isoToTimestamptz(item.created_at))}::timestamptz,
  ${sqlLiteral(isoToTimestamptz(item.updated_at))}::timestamptz,
  ${unixToTimestamptz(item.last_run_at) ? `${sqlLiteral(unixToTimestamptz(item.last_run_at)!)}::timestamptz` : "NULL"},
  ${lastOutputRef != null ? sqlLiteral(lastOutputRef) : "NULL"}
)
ON CONFLICT (id) DO NOTHING;
`);
    migrated++;
  }

  if (!args.dryRun && statements.length) {
    const tmpDir = mkdtempSync(join(tmpdir(), "migrate-cron-"));
    const sqlPath = join(tmpDir, "migrate.sql");
    writeFileSync(sqlPath, statements.join("\n"), "utf-8");
    execSync(`psql ${sqlLiteral(args.databaseUrl)} -v ON_ERROR_STOP=1 -f ${sqlLiteral(sqlPath)}`, {
      stdio: "inherit",
    });
  }

  console.log(`完成：迁移 ${migrated} 条，跳过 ${skipped} 条`);
  console.log("提示：验证 WebUI /chamber/cron 后可归档 ~/.anima/cron/jobs.json");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
