import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { clearConfigCache } from "@freeanima/legacy-kernel";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/legacy-kernel";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { closeDb, type Db, setDbForTest } from "../client";
import { appendMessage } from "../repos/message-repo";
import { upsertSessionMeta } from "../repos/session-repo";
import { relations } from "../schema/index";

export type PgTestContext = {
  sql: postgres.Sql;
  db: Db;
  teardown: () => Promise<void>;
};

let activeCtx: PgTestContext | null = null;

async function clearPgTables(sql: postgres.Sql): Promise<void> {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM sessions`;
}

/** Vitest 等根目录测试：注入 PG 连接并清表 */
export async function setupPgTestDb(url: string): Promise<PgTestContext> {
  const sql = postgres(url, { max: 5 });
  await clearPgTables(sql);
  const db = drizzle({ client: sql, relations });
  setDbForTest(db, sql);
  return {
    sql,
    db,
    async teardown() {
      await sql.end();
      await closeDb();
    },
  };
}

function writeDatabaseConfig(home: string, url: string, extraYaml?: string): void {
  const base = `database:\n  url: ${JSON.stringify(url)}\n`;
  writeFileSync(join(home, "config.yaml"), extraYaml ? `${base}${extraYaml}` : base, "utf-8");
}

/**
 * 集成测试标准 setup：临时 FREEANIMA_HOME + database.url + PG 连接。
 * 同一进程内复用连接，每用例清表（避免 afterEach 关连接导致 CONNECTION_ENDED）。
 */
export async function setupIntegrationHome(opts: {
  url: string;
  home: string;
  configYaml?: string;
}): Promise<PgTestContext> {
  writeDatabaseConfig(opts.home, opts.url, opts.configYaml);
  clearConfigCache();
  if (activeCtx) {
    await clearPgTables(activeCtx.sql);
    return activeCtx;
  }
  activeCtx = await setupPgTestDb(opts.url);
  return activeCtx;
}

/** 集成测试套件结束时关闭 PG 连接 */
export async function teardownIntegrationHome(): Promise<void> {
  if (activeCtx) {
    await activeCtx.teardown();
    activeCtx = null;
  }
}

/** 在已有 config.yaml 末尾追加 YAML 并刷新配置缓存 */
export function appendIntegrationConfig(home: string, yaml: string): void {
  const path = join(home, "config.yaml");
  const existing = readFileSync(path, "utf-8");
  writeFileSync(path, `${existing.trimEnd()}\n${yaml}`, "utf-8");
  clearConfigCache();
}

/** 通过 PG repo 写入 session（替代 sessions/*.jsonl fixture） */
export async function seedSession(
  sessionId: string,
  meta: SessionMetaMessage,
  messages: SessionMessage[] = [],
): Promise<void> {
  await upsertSessionMeta(sessionId, meta);
  for (const msg of messages) {
    await appendMessage(sessionId, msg);
  }
}
