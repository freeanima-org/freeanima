import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  closeDb,
  initDatabase,
  setDbForTest,
  type Db,
  type SqlClient,
} from "@freeanima/habitat/core/db/pg";
import { bindSearchRuntime } from "@freeanima/habitat/core/db/pg/search";
import { createEngine } from "@freeanima/habitat/engine";
import {
  initLlmRuntime,
  registerLlmStackConfigurator,
  resetLlmRuntimeForTests,
} from "@freeanima/habitat/core/llm";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import {
  createConversationService,
  type ConversationService,
} from "@freeanima/habitat/engine/conversation";
import { appendMessage, upsertConversationMeta } from "@freeanima/habitat/core/db/pg/conversation";
import { FileConfig } from "@freeanima/habitat/platform/config/file-config.ts";
import { type Config } from "@freeanima/habitat/platform/config";
import { bindActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { bindResolvedWorldContext } from "@freeanima/habitat/core/config/world-context";
import { getResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context";
import { ensureWorldSubjects } from "@freeanima/habitat/core/db/pg/entity/subject-world";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import type { StoredMessage, ConversationMetaMessage } from "@freeanima/habitat/core/db/domain";
import { relations } from "@freeanima/habitat/core/db/schema";
import { drizzle } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";
import type { Engine } from "@freeanima/habitat/engine";

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

function createTestEngine(config: Config): Engine {
  registerLlmStackConfigurator(bindLlmStack);
  const llm = initLlmRuntime(config.data);
  return createEngine({ llm, config, logger: createTestLogger() });
}

function bindEngine(config: Config): Engine {
  const engine = createTestEngine(config);
  if (activeCtx) activeCtx.engine = engine;
  return engine;
}

function createTestSql(url: string): { sql: SqlClient; db: Db } {
  const sql = new SQL(url);
  const db = drizzle({ client: sql, relations });
  return { sql, db };
}

/**
 * 初始化 PG 测试连接并 seed world context。
 * 每个测试文件使用独立数据库（由 createIsolatedTestDb 建库 + migrate），
 * 因此不再需要 clearPgTables。
 */
export async function setupPgTestDb(url: string, config: Config): Promise<PgTestContext> {
  initDatabase({ getDatabaseUrl: () => url });
  bindActiveRuntimeConfig(config);
  bindSearchRuntime(config);
  const { sql, db } = createTestSql(url);
  setDbForTest(db, sql);
  await ensureIntegrationWorldContext(config);
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
connections:
  main:
    preset: custom
    custom_kind: text
    text_protocol: openai_compatible
    base_url: https://api.openai.com/v1
    api_key: test-key
text_generate:
  main:
    connection: main
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
 * Standard integration setup: temp FREEANIMA_HOME + 进程独立 PG。
 * 同进程复用连接；不清表（隔离靠独立库 / --parallel --isolate）。
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
    activeCtx.config = config;
    bindEngine(config);
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
    bindEngine(config);
  }
}

/**
 * 补齐 PG messages 写入所需的 subject_id（与 engine conversation.appendMessage 默认一致）。
 * 直接调 core/db appendMessage 的集成测应经此函数或 appendTestMessage。
 */
export function withTestSubjectId(msg: StoredMessage): StoredMessage {
  if (msg.subject_id != null) return msg;
  const ctx = getResolvedWorldContext();
  if (msg.role === "user") {
    return { ...msg, subject_id: ctx.user_subject_id };
  }
  return { ...msg, subject_id: ctx.agent_subject_id };
}

/** PG 层 appendMessage，自动补 subject_id */
export async function appendTestMessage(conversationId: string, msg: StoredMessage): Promise<void> {
  await appendMessage(conversationId, withTestSubjectId(msg));
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
    await appendTestMessage(conversationId, msg);
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
