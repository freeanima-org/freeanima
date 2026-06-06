#!/usr/bin/env bun
/**
 * 一次性迁移：~/.anima/memory/f-*.md → PG semantic_memory 表。
 *
 * 用法：
 *   DATABASE_URL="$(anima credential get services/postgres/anima url)" \
 *     bun run scripts/migrate-semantic-memory.ts [--dry-run] [--home ~/.anima]
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { homedir } from "node:os";
import { parseLegacyFact } from "../life/memory/src/legacy-fact.ts";
import { normalizeSemanticMemoryType } from "../life/memory/src/schemas/fact.ts";

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

function listLegacyFactFiles(memoryDir: string): string[] {
  if (!existsSync(memoryDir)) return [];
  return readdirSync(memoryDir)
    .filter((name) => name.startsWith("f-") && name.endsWith(".md"))
    .toSorted()
    .map((name) => join(memoryDir, name));
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const memoryDir = join(args.home, "memory");
  const files = listLegacyFactFiles(memoryDir);

  console.log(`扫描目录: ${memoryDir}`);
  console.log(`发现 ${files.length} 个 f-*.md 文件`);
  if (args.dryRun) console.log("（dry-run 模式，不写入数据库）");

  let inserted = 0;
  let skipped = 0;
  const errors: string[] = [];
  const statements: string[] = [];

  for (const path of files) {
    const text = readFileSync(path, "utf-8");
    const fact = parseLegacyFact(text);
    if (!fact) {
      skipped++;
      errors.push(`${path}: 解析失败`);
      continue;
    }

    const row = {
      id: fact.id,
      type: normalizeSemanticMemoryType(fact.type),
      pinned: false,
      content: fact.content,
      created: fact.created,
      updated: fact.updated,
    };

    if (args.dryRun) {
      console.log(`[dry-run] ${row.id} (${row.type}) ${row.content.slice(0, 60)}…`);
      inserted++;
      continue;
    }

    statements.push(`
INSERT INTO semantic_memory (id, type, pinned, content, created, updated)
VALUES (
  ${sqlLiteral(row.id)},
  ${sqlLiteral(row.type)},
  false,
  ${sqlLiteral(row.content)},
  ${sqlLiteral(row.created)}::timestamptz,
  ${sqlLiteral(row.updated)}::timestamptz
)
ON CONFLICT (id) DO UPDATE SET
  type = EXCLUDED.type,
  content = EXCLUDED.content,
  updated = EXCLUDED.updated;
`);
    inserted++;
  }

  if (!args.dryRun && statements.length) {
    const tmpDir = mkdtempSync(join(tmpdir(), "migrate-semantic-"));
    const sqlPath = join(tmpDir, "migrate.sql");
    writeFileSync(sqlPath, statements.join("\n"), "utf-8");
    execSync(`psql ${sqlLiteral(args.databaseUrl)} -v ON_ERROR_STOP=1 -f ${sqlLiteral(sqlPath)}`, {
      stdio: "inherit",
    });
  }

  console.log(`完成：写入/更新 ${inserted} 条，跳过 ${skipped} 条`);
  if (errors.length) {
    console.log("错误：");
    for (const e of errors) console.log(`  - ${e}`);
  }
  console.log("提示：验证 recall 后，可手动归档 ~/.anima/memory/f-*.md 与 ~/.anima/index/l3.db");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
