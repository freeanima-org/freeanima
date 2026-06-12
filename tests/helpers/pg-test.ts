import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  createPgRepositories,
  closeDb,
  getDb,
  initDatabase,
  setDbForTest,
  type Db,
  type SqlClient,
} from "@freeanima/connectors-db-pg";
import { createEngine } from "@freeanima/orchestration-runtime";
import {
  initLlmRuntime,
  registerLlmStackConfigurator,
  resetLlmRuntimeForTests,
} from "@freeanima/mechanism-llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/orchestration-conversation";
import type { PgRepositories } from "@freeanima/storage-repos";
import { FileConfig, type Config } from "@freeanima/service-config";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import type { SessionMessage, SessionMetaMessage } from "@freeanima/storage-db/domain";
import { relations } from "@freeanima/storage-db/schema";
import { drizzle } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";
import type { Engine } from "@freeanima/orchestration-runtime";

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

async function clearPgTables(sql: SqlClient): Promise<void> {
  await sql`DELETE FROM memory_references`;
  await sql`DELETE FROM messages`;
  await sql`DELETE FROM sessions`;
  await sql`DELETE FROM semantic_memory`;
  await sql`DELETE FROM self_blocks`;
  await sql`DELETE FROM autobiographical_memory`;
  await sql`DELETE FROM limbic_memory`;
  await sql`DELETE FROM tasks`;
  await sql`DELETE FROM cron_jobs`;
}

function createTestEngine(repos: PgRepositories, config: Config): Engine {
  registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
  const llm = initLlmRuntime(config.data);
  return createEngine({ repos, llm, config, logger: createTestLogger() });
}

function wireEngine(config: Config): Engine {
  const engine = createTestEngine(createPgRepositories({ getDb }), config);
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
  const { sql, db } = createTestSql(url);
  await clearPgTables(sql);
  setDbForTest(db, sql);
  const engine = createTestEngine(createPgRepositories({ getDb }), config);
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
  if (activeCtx) {
    await clearPgTables(activeCtx.sql);
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
    activeCtx.config = FileConfig.open();
    wireEngine(activeCtx.config);
  }
}

/** Write session fixture via Session port */
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
    throw new Error("Integration test PG harness not initialized; call beginIntegrationCase first");
  }
  return activeCtx.engine;
}

export function testConv(): ConversationService {
  const engine = getTestEngine();
  return createConversationService(engine.repos, engine.catalog.toolSets);
}
