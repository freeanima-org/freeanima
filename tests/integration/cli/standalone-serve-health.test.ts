import { it, expect, beforeAll, beforeEach, afterEach, afterAll } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  closeDb,
  initDatabase,
  upsertHabitatRuntimeConfigDocument,
} from "@freeanima/habitat/core/db/pg";
import { describePg, pgTestUrl } from "../../helpers/pg-test-gate.ts";
import { beginLogIsolation } from "../../helpers/log-isolation.ts";
import { restoreIntegrationHome } from "../../helpers/integration-case.ts";
import { writeIntegrationDatabaseConfig } from "../../helpers/pg-test.ts";
import { createIsolatedTestDb, dropIsolatedTestDb } from "../../helpers/isolated-pg.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const standaloneRoot = join(repoRoot, "dist/anima-executable");
const standaloneBin = join(standaloneRoot, "anima");
const TEST_PORT = 18_658;
const HEALTH_TIMEOUT_MS = 120_000;

const STANDALONE_RUNTIME_CONFIG = {
  connections: {
    main: {
      preset: "custom",
      custom_kind: "text",
      text_protocol: "openai_compatible",
      base_url: "https://api.openai.com/v1",
      api_key: "test-key",
    },
  },
  text_generate: { main: { connection: "main", model: "test-model" } },
};

async function seedRuntimeConfig(url: string): Promise<void> {
  initDatabase({ getDatabaseUrl: () => url });
  await upsertHabitatRuntimeConfigDocument(STANDALONE_RUNTIME_CONFIG);
  await closeDb();
}

function assertStandaloneBuilt(): void {
  if (existsSync(standaloneBin)) return;
  throw new Error(
    "dist/anima-executable/anima 不存在；请先运行 `just pack cli`（CI Quality 作业会在集成测试前构建）",
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForHealth(
  port: number,
  timeoutMs = HEALTH_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/rpc/v1/health/probe`);
      if (res.ok) {
        const body = (await res.json()) as Record<string, unknown>;
        if (body.status === "ok") return body;
      }
    } catch (err) {
      lastError = err;
    }
    await sleep(500);
  }
  throw new Error(`health check timed out: ${String(lastError)}`);
}

function stopChild(child: ChildProcess | null): void {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
}

describePg("standalone CLI HTTP health", () => {
  const prevHome = process.env.FREEANIMA_HOME;
  let child: ChildProcess | null = null;
  let home = "";
  let dbSlug = "";
  let dbUrl = "";

  beforeAll(() => {
    assertStandaloneBuilt();
  });

  beforeEach(async () => {
    if (!pgTestUrl) throw new Error("ANIMA_TEST_PG_URL is not set");
    dbSlug = `standalone_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    dbUrl = createIsolatedTestDb(dbSlug);
    home = beginLogIsolation("standalone-cli-serve-");
    writeIntegrationDatabaseConfig(home, dbUrl);
    await seedRuntimeConfig(dbUrl);

    child = spawn(
      standaloneBin,
      ["service", "start", "--foreground", "--port", String(TEST_PORT)],
      {
        env: {
          ...process.env,
          FREEANIMA_HOME: home,
          FREEANIMA_REPO_ROOT: standaloneRoot,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString();
      if (line.includes("[startup]") || line.includes("Error")) {
        process.stderr.write(`[standalone-cli-serve] ${line}`);
      }
    });
  });

  afterEach(async () => {
    stopChild(child);
    child = null;
    await sleep(300);
    await restoreIntegrationHome(prevHome);
    if (dbSlug) {
      dropIsolatedTestDb(dbSlug);
      dbSlug = "";
      dbUrl = "";
    }
  });

  afterAll(async () => {
    if (dbSlug) dropIsolatedTestDb(dbSlug);
  });

  it(
    "GET /rpc/v1/health/probe returns status ok from standalone executable",
    async () => {
      const body = await waitForHealth(TEST_PORT);
      expect(body.status).toBe("ok");
      expect(typeof body.version).toBe("string");
    },
    HEALTH_TIMEOUT_MS,
  );
});
