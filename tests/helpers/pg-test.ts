import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  closeDb,
  initDatabase,
  setDbForTest,
  type Db,
  type SqlClient,
} from "@freeanima/core/db/pg";
import { createEngine } from "@freeanima/runtime";
import {
  initLlmRuntime,
  registerLlmStackConfigurator,
  resetLlmRuntimeForTests,
} from "@freeanima/core/llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities/llm-openai";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/runtime/conversation";
import { appendMessage, upsertConversationMeta } from "@freeanima/core/db/pg/conversation";
import { FileConfig } from "@freeanima/platform/config/file-config.ts";
import { type Config } from "@freeanima/platform/config";
import { bindActiveRuntimeConfig } from "@freeanima/core/config";
import { bindResolvedWorldContext } from "@freeanima/core/config/world-context";
import { ensureWorldSubjects } from "@freeanima/core/db/pg/entity/subject-world";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import type { StoredMessage, ConversationMetaMessage } from "@freeanima/core/db/domain";
import { relations } from "@freeanima/core/db/schema";
import { drizzle } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";
import type { Engine } from "@freeanima/runtime";

export type PgTestContext = {
  sql: SqlClient;
  db: Db;
  engine: Engine;
  config: Config;
  teardown: () => Promise<void>;
};

let activeCtx: PgTestContext | null = null;

export function getActivePgTestContext(): PgTestContext | null {
  return activeCtx;
}

async function ensureIntegrationWorldContext(config: Config): Promise<void> {
  const ctx = await ensureWorldSubjects(config.data);
  bindResolvedWorldContext(ctx);
}

async function clearPgTables(sql: SqlClient, config: Config): Promise<void> {
  await sql`DELETE FROM memory_references`;
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM conversations`;
  await sql`DELETE FROM self_blocks`;
  await sql`DELETE FROM service_api_tokens`;
  await sql`DELETE FROM entities`;
  await ensureIntegrationWorldContext(config);
  await sql`DELETE FROM notifications`;
  await sql`DELETE FROM cron_jobs`;
}

function createTestEngine(config: Config): Engine {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
  const llm = initLlmRuntime(config.data);
  return createEngine({ llm, config, logger: createTestLogger() });
}

function wireEngine(config: Config): Engine {
  const engine = createTestEngine(config);
  if (activeCtx) activeCtx.engine = engine;
  return engine;
}

/** Root-level tests (Vitest, etc.): inject PG connection and clear tables */
function createTestSql(url: string): { sql: SqlClient; db: Db } {
  const sql = new SQL(url);
  const db = drizzle({ client: sql, relations });
  return { sql, db };
}

export async function setupPgTestDb(url: string, config: Config): Promise<PgTestContext> {
  initDatabase({ getDatabaseUrl: () => url });
  bindActiveRuntimeConfig(config);
  const { sql, db } = createTestSql(url);
  // ensureWorldSubjects（clearPgTables 内）走 getDb()，须先注入测试连接以免泄漏孤儿连接
  setDbForTest(db, sql);
  await clearPgTables(sql, config);
  const engine = createTestEngine(config);
  activeCtx = {
    sql,
    db,
    engine,
    config,
    async teardown() {
      sql.close();
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

/** 仅写入 integration 用 config.yaml（不初始化进程内 PG harness） */
export function writeIntegrationDatabaseConfig(
  home: string,
  url: string,
  extraYaml?: string,
): void {
  writeDatabaseConfig(home, url, extraYaml);
}

/**
 * Standard integration test setup: temp FREEANIMA_HOME + database.url + PG connection.
 * Reuses connection within the same process; clears tables per case (avoids CONNECTION_ENDED from closing in afterEach).
 */
export async function setupIntegrationHome(opts: {
  url: string;
  home: string;
  configYaml?: string;
}): Promise<PgTestContext> {
  writeDatabaseConfig(opts.home, opts.url, opts.configYaml);
  const config = FileConfig.open();
  bindActiveRuntimeConfig(config);
  if (activeCtx) {
    await clearPgTables(activeCtx.sql, config);
    activeCtx.config = config;
    wireEngine(config);
    return activeCtx;
  }
  return setupPgTestDb(opts.url, config);
}

/** Close PG connection when integration test suite finishes */
export async function teardownIntegrationHome(): Promise<void> {
  if (activeCtx) {
    await activeCtx.teardown();
  }
}

/** Append YAML to existing config.yaml and refresh config */
export function appendIntegrationConfig(home: string, yaml: string): void {
  const path = join(home, "config.yaml");
  const existing = readFileSync(path, "utf-8");
  writeFileSync(path, `${existing.trimEnd()}\n${yaml}`, "utf-8");
  if (activeCtx) {
    const config = FileConfig.open();
    activeCtx.config = config;
    bindActiveRuntimeConfig(config);
    wireEngine(config);
  }
}

/** Write conversation fixture via PG conversation API */
export async function seedSession(
  _engine: Engine,
  conversationId: string,
  meta: ConversationMetaMessage,
  messages: StoredMessage[] = [],
): Promise<void> {
  await upsertConversationMeta(conversationId, meta);
  for (const msg of messages) {
    await appendMessage(conversationId, msg);
  }
}

export function getTestEngine(): Engine {
  if (!activeCtx) {
    throw new Error("Integration test PG harness not initialized; call beginIntegrationCase first");
  }
  return activeCtx.engine;
}

export function testConv(): ConversationService {
  const engine = getTestEngine();
  return createConversationService(engine.catalog.toolSets);
}
