#!/usr/bin/env node
/**
 * JSONL → PostgreSQL 迁移（可重复执行：session upsert + message onConflictDoNothing）。
 * 用法: DATABASE_URL=... node packages/db/dist/migrate-jsonl.js [--dry-run] [sessions-dir]
 *
 * 输出：运行中仅 stderr 进度行；结束后 stdout 统计；失败明细仅在末尾且截断。
 */
import { createReadStream, readdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { PATHS } from "@freeanima/kernel";
import {
  parseSessionLine,
  type SessionMessage,
  type SessionMetaMessage,
} from "@freeanima/kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql as drizzleSql } from "drizzle-orm";
import postgres from "postgres";

import { setDbForTest, getDb } from "./client.js";
import { shortDbError } from "./utils/db-error.js";
import { assertMessagesSchema } from "./utils/schema-check.js";
import { messageToInsert } from "./mappers/message-mapper.js";
import { upsertSessionMeta } from "./repos/session-repo.js";
import { relations } from "./schema/index.js";
import { messages } from "./schema/messages.js";
import { sessions } from "./schema/sessions.js";

const FAILURE_DETAIL_LIMIT = 20;
const PROGRESS_EVERY_N = 50;

interface SessionFailure {
  sessionId: string;
  error: string;
}

interface MigrateSummary {
  dryRun: boolean;
  sessionsDir: string;
  total: number;
  ok: number;
  failed: number;
  messages: number;
  failures: SessionFailure[];
}

const stderrIsTTY = Boolean(process.stderr.isTTY);

async function readJsonlSession(
  filePath: string,
): Promise<{ meta: SessionMetaMessage; messages: SessionMessage[] } | null> {
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  let meta: SessionMetaMessage | null = null;
  const msgs: SessionMessage[] = [];
  for await (const line of rl) {
    if (!line.trim()) continue;
    const parsed = parseSessionLine(line);
    if (!parsed) continue;
    if (parsed.role === "session_meta") {
      meta = parsed;
      continue;
    }
    if (parsed.role === "system") {
      continue;
    }
    msgs.push(parsed);
  }
  if (!meta) return null;
  return { meta, messages: msgs };
}

async function migrateSession(
  sessionId: string,
  filePath: string,
  dryRun: boolean,
): Promise<{ messageCount: number }> {
  const data = await readJsonlSession(filePath);
  if (!data) {
    throw new Error("缺少 session_meta");
  }

  const { meta, messages: jsonlMsgs } = data;

  if (dryRun) {
    return { messageCount: jsonlMsgs.length };
  }

  await upsertSessionMeta(sessionId, meta);

  if (jsonlMsgs.length) {
    const db = getDb();
    const rows = jsonlMsgs.map((m) => messageToInsert(sessionId, m));
    await db
      .insert(messages)
      .values(rows)
      .onConflictDoNothing({ target: [messages.sessionId, messages.pos] });
  }

  return { messageCount: jsonlMsgs.length };
}

function writeProgress(current: number, total: number, sessionId: string): void {
  const pad = String(total).length;
  const label = `[${String(current).padStart(pad)}/${total}] ${sessionId}`;
  if (stderrIsTTY) {
    process.stderr.write(`\r\x1b[K${label}`);
    return;
  }
  if (current === 1 || current === total || current % PROGRESS_EVERY_N === 0) {
    process.stderr.write(`${label}\n`);
  }
}

function finishProgress(): void {
  if (stderrIsTTY) {
    process.stderr.write("\r\x1b[K");
  }
}

function printSummary(summary: MigrateSummary): void {
  const lines = [
    summary.dryRun ? "迁移预览（dry-run，未写入 PG）" : "迁移完成",
    `  目录: ${summary.sessionsDir}`,
    `  会话: ${summary.ok} 成功 / ${summary.failed} 失败 / ${summary.total} 总计`,
    `  消息: ${summary.messages} 条（JSONL 计数，重复运行跳过已存在 message）`,
  ];
  console.log(lines.join("\n"));
  if (!summary.failures.length) return;

  console.log(`失败明细（${summary.failures.length}）:`);
  const shown = summary.failures.slice(0, FAILURE_DETAIL_LIMIT);
  for (const f of shown) {
    console.log(`  - ${f.sessionId}: ${f.error}`);
  }
  const rest = summary.failures.length - shown.length;
  if (rest > 0) {
    console.log(`  … 还有 ${rest} 个未列出`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dirArg = args.find((a) => !a.startsWith("--"));
  const sessionsDir = dirArg ?? PATHS.sessions;
  const url = process.env.DATABASE_URL;
  if (!url && !dryRun) {
    console.error("DATABASE_URL 未设置");
    process.exit(1);
  }

  const files = readdirSync(sessionsDir)
    .filter((f) => f.endsWith(".jsonl"))
    .sort();
  const total = files.length;
  const failures: SessionFailure[] = [];
  let ok = 0;
  let messages = 0;

  let pgClient: postgres.Sql | undefined;
  try {
    if (!dryRun) {
      pgClient = postgres(url!, {
        max: 5,
        onnotice: () => {},
      });
      const db = drizzle({ client: pgClient, relations });
      setDbForTest(db, pgClient);
      try {
        await db.execute(drizzleSql`SELECT 1 FROM ${sessions} LIMIT 0`);
        await assertMessagesSchema(db);
      } catch (e) {
        throw new Error(
          `PostgreSQL schema 未就绪，请先执行: pnpm --filter @freeanima/db db:migrate (${shortDbError(e)})`,
        );
      }
    }

    for (let i = 0; i < files.length; i++) {
      const f = files[i]!;
      const sessionId = f.slice(0, -6);
      const filePath = join(sessionsDir, f);
      writeProgress(i + 1, total, sessionId);
      try {
        const { messageCount } = await migrateSession(sessionId, filePath, dryRun);
        ok += 1;
        messages += messageCount;
      } catch (e) {
        failures.push({ sessionId, error: shortDbError(e) });
      }
    }
  } finally {
    finishProgress();
    if (pgClient) await pgClient.end();
  }

  printSummary({
    dryRun,
    sessionsDir,
    total,
    ok,
    failed: failures.length,
    messages,
    failures,
  });

  if (failures.length) process.exit(1);
}

main().catch((e) => {
  console.error(shortDbError(e));
  process.exit(1);
});
