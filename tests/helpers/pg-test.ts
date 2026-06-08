import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createPgRepositories,
  closeDb,
  getDb,
  initDatabase,
  setDbForTest,
  type Db,
} from "@freeanima/connectors-db-pg";
import { createEngine } from "@freeanima/engine";
import {
  createLlmRuntime,
  registerLlmStackConfigurator,
  resetLlmRuntimeForTests,
} from "@freeanima/engine-llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-provider-openai-compatible";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/engine-conversation";
import type { PgRepositories } from "@freeanima/engine-repos";
import { clearConfigCache, loadConfig } from "@freeanima/service-config";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/engine-db/domain";
import { relations } from "@freeanima/engine-db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Engine } from "@freeanima/engine";

export type PgTestContext = {
  sql: postgres.Sql;
  db: Db;
  engine: Engine;
  teardown: () => Promise<void>;
};

let activeCtx: PgTestContext | null = null;

export function getActivePgTestContext(): PgTestContext | null {
  return activeCtx;
}

async function clearPgTables(sql: postgres.Sql): Promise<void> {
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM sessions`;
  await sql`DELETE FROM semantic_memory`;
  await sql`DELETE FROM self_blocks`;
  await sql`DELETE FROM autobiographical_memory`;
  await sql`DELETE FROM limbic_memory`;
  await sql`DELETE FROM tasks`;
  await sql`DELETE FROM cron_jobs`;
}

function createTestEngine(repos: PgRepositories): Engine {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
  return createEngine({ repos, llm: createLlmRuntime(loadConfig()) });
}

function wireEngine(): Engine {
  const engine = createTestEngine(createPgRepositories({ getDb }));
  if (activeCtx) activeCtx.engine = engine;
  return engine;
}

/** Vitest 等根目录测试：注入 PG 连接并清表 */
export async function setupPgTestDb(url: string): Promise<PgTestContext> {
  initDatabase({ getDatabaseUrl: () => url });
  const sql = postgres(url, { max: 5 });
  await clearPgTables(sql);
  const db = drizzle({ client: sql, relations });
  setDbForTest(db, sql);
  const engine = createTestEngine(createPgRepositories({ getDb }));
  activeCtx = {
    sql,
    db,
    engine,
    async teardown() {
      await sql.end();
      await closeDb();
      resetLlmRuntimeForTests();
      activeCtx = null;
    },
  };
  return activeCtx;
}

const INTEGRATION_LLM_YAML = `
llm:
  default_profile: chat
  providers:
    main:
      backend: openai_compatible
      base_url: https://api.openai.com/v1
      api_key: test-key
  profiles:
    chat:
      chain:
        - provider: main
          model: test-model
    reflect:
      chain:
        - provider: main
          model: test-model
    summary:
      chain:
        - provider: main
          model: test-model
`;

function writeDatabaseConfig(home: string, url: string, extraYaml?: string): void {
  const base = `database:\n  url: ${JSON.stringify(url)}\n${INTEGRATION_LLM_YAML}`;
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
    wireEngine();
    return activeCtx;
  }
  return setupPgTestDb(opts.url);
}

/** 集成测试套件结束时关闭 PG 连接 */
export async function teardownIntegrationHome(): Promise<void> {
  if (activeCtx) {
    await activeCtx.teardown();
  }
}

/** 在已有 config.yaml 末尾追加 YAML 并刷新配置缓存 */
export function appendIntegrationConfig(home: string, yaml: string): void {
  const path = join(home, "config.yaml");
  const existing = readFileSync(path, "utf-8");
  writeFileSync(path, `${existing.trimEnd()}\n${yaml}`, "utf-8");
  clearConfigCache();
}

/** 通过 Session 端口写入 session（替代 sessions/*.jsonl fixture） */
export async function seedSession(
  engine: Engine,
  sessionId: string,
  meta: SessionMetaMessage,
  messages: SessionMessage[] = [],
): Promise<void> {
  const session = engine.repos.session;
  await session.upsertSessionMeta(sessionId, meta);
  for (const msg of messages) {
    await session.appendMessage(sessionId, msg);
  }
}

export function getTestEngine(): Engine {
  if (!activeCtx) {
    throw new Error("集成测试 PG harness 未初始化；请先 beginIntegrationCase");
  }
  return activeCtx.engine;
}

export function testConv(): ConversationService {
  return createConversationService(getTestEngine().repos);
}
