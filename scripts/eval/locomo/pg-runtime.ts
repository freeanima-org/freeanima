/**
 * 隔离评测运行时：只写 FREEANIMA_HOME（.cache/locomo/home），永不碰用户 ~/.anima/config.yaml。
 */
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { runMigrations as applyMigrations } from "@freeanima/habitat/core/db/index.ts";
import {
  closeDb,
  getDb,
  initDatabase,
  setDbForTest,
} from "@freeanima/habitat/core/db/pg/client.ts";
import { bindSearchRuntime } from "@freeanima/habitat/core/db/pg/search";
import { relations } from "@freeanima/habitat/core/db/schema";
import { bindActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { bindResolvedWorldContext } from "@freeanima/habitat/core/config/resolved-world-context";
import { ensureWorldSubjects } from "@freeanima/habitat/core/db/pg/entity/subject-world";
import {
  initLlmRuntime,
  registerLlmStackConfigurator,
  resetLlmRuntimeForTests,
} from "@freeanima/habitat/core/llm";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import { createEngine } from "@freeanima/habitat/engine";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import { FileConfig } from "@freeanima/habitat/platform/config/file-config.ts";
import { asRecord } from "@freeanima/shared/util";
import { initRedis, resetRedisForTest } from "@freeanima/habitat/core/redis";
import {
  createEmbeddedMemoryService,
  registerRetainEngine,
  resetRetainEngineForTests,
  resetRetainLlmForTests,
  type MemoryService,
} from "@freeanima/habitat/capabilities/memory/service";
import { drizzle } from "drizzle-orm/bun-sql/postgres";
import { SQL } from "bun";

import {
  resolveLocomoApiKey,
  resolveLocomoBaseUrl,
  resolveLocomoModel,
  resolveLocomoPgUrl,
  resolveLocomoRedisUrl,
} from "./env.ts";
import { completeText } from "./llm.ts";
import { asString } from "./coerce.ts";

export type LocomoPgRuntime = {
  service: MemoryService;
  pgUrl: string;
  home: string;
  teardown: () => Promise<void>;
};

function assertNotDailyPort(pgUrl: string): void {
  try {
    const u = new URL(pgUrl);
    const port = u.port || "5432";
    if (port === "5432") {
      throw new Error(
        `LoCoMo PG URL 使用了日常端口 5432（${pgUrl}）。请用 compose 默认 55432，或设置 LOCOMO_PG_URL。`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("日常端口")) throw e;
    throw new Error(`invalid LOCOMO_PG_URL: ${pgUrl}`, { cause: e });
  }
}

async function waitForPg(pgUrl: string, attempts = 60): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      execSync(`psql "${pgUrl}" -c "SELECT 1"`, { stdio: "ignore" });
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error(
    `PostgreSQL 未就绪（${pgUrl}）。请先: docker compose -f scripts/eval/locomo/compose.yaml up -d`,
  );
}

function writeEvalConfigYaml(home: string, pgUrl: string, redisUrl: string): void {
  mkdirSync(home, { recursive: true });
  const apiKey = resolveLocomoApiKey() ?? "locomo-dry-placeholder";
  const baseUrl = resolveLocomoBaseUrl();
  const model = resolveLocomoModel();
  const yaml = `database:
  url: ${JSON.stringify(pgUrl)}
redis:
  url: ${JSON.stringify(redisUrl)}
connections:
  main:
    preset: custom
    custom_kind: text
    text_protocol: openai_compatible
    base_url: ${JSON.stringify(baseUrl)}
    api_key: ${JSON.stringify(apiKey)}
text_generate:
  main:
    connection: main
    model: ${JSON.stringify(model)}
memory:
  deployment: embedded
  passive_recall:
    enabled: false
`;
  writeFileSync(join(home, "config.yaml"), yaml, "utf-8");
}

async function migrate(pgUrl: string): Promise<void> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const extensionsPath = join(repoRoot, "packages/habitat/core/scripts/ensure-pg-extensions.sql");
  try {
    execSync(`psql "${pgUrl}" -v ON_ERROR_STOP=1 -f "${extensionsPath}"`, {
      stdio: "ignore",
    });
  } catch {
    // 非 superuser 时扩展可能已存在
  }
  initDatabase({ getDatabaseUrl: () => pgUrl });
  try {
    await applyMigrations(getDb());
  } finally {
    await closeDb();
  }
}

/** 启动隔离 PG/Redis 运行时（config 仅写入 eval home） */
export async function beginLocomoPgRuntime(opts: {
  home: string;
  dryRun: boolean;
}): Promise<LocomoPgRuntime> {
  const pgUrl = resolveLocomoPgUrl();
  assertNotDailyPort(pgUrl);
  await waitForPg(pgUrl);

  const redisUrl = resolveLocomoRedisUrl();
  writeEvalConfigYaml(opts.home, pgUrl, redisUrl);

  resetRedisForTest();
  initRedis({ getRedisUrl: () => redisUrl });

  await migrate(pgUrl);

  const config = FileConfig.open();
  bindActiveRuntimeConfig(config);
  bindSearchRuntime(config);

  initDatabase({ getDatabaseUrl: () => pgUrl });
  const sql = new SQL(pgUrl);
  const db = drizzle({ client: sql, relations });
  setDbForTest(db, sql);

  const world = await ensureWorldSubjects(config.data);
  bindResolvedWorldContext(world);

  registerLlmStackConfigurator(bindLlmStack);
  const llm = initLlmRuntime(config.data);
  createEngine({ llm, config, logger: createTestLogger() });

  resetRetainEngineForTests();
  resetRetainLlmForTests();

  // 真 retain：LLM 抽事实 → remember 进 PG（同表，供 hybrid FTS recall）
  registerRetainEngine(async ({ texts }) => {
    if (opts.dryRun) {
      return {
        items: texts
          .map((t) => t.trim())
          .filter(Boolean)
          .map((content) => ({ action: "create" as const, content, kind: "observation" })),
      };
    }
    const blob = texts.join("\n").slice(0, 12_000);
    const raw = await completeText({
      dryRun: false,
      system:
        "Extract durable facts from the dialogue for a long-term memory store. " +
        'Reply with ONLY a JSON array of objects: [{"content":"...","kind":"world"|"observation"|"preference"}]. ' +
        "No markdown. Max 12 items. Skip greetings.",
      user: blob,
    });
    let parsed: unknown;
    try {
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
    } catch {
      parsed = [];
    }
    const items: Array<{ action: "create"; content: string; kind: string }> = [];
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        if (!row || typeof row !== "object") continue;
        const r = asRecord(row);
        if (!r) continue;
        const content = asString(r.content).trim();
        if (!content) continue;
        const kind = asString(r.kind, "observation") || "observation";
        items.push({ action: "create", content, kind });
      }
    }
    if (items.length === 0 && blob) {
      items.push({ action: "create", content: blob.slice(0, 500), kind: "observation" });
    }
    return { items };
  });

  const service = createEmbeddedMemoryService();

  return {
    service,
    pgUrl,
    home: opts.home,
    async teardown() {
      resetRetainEngineForTests();
      resetRetainLlmForTests();
      resetLlmRuntimeForTests();
      resetRedisForTest();
      void sql.close();
      await closeDb();
    },
  };
}
