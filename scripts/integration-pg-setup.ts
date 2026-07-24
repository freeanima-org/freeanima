import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = join(repoRoot, "src/core");
const TEMPLATE_DB = "anima_it_template";

function parseHostPort(url: string): { host: string; port: string } | null {
  try {
    const u = new URL(url);
    return { host: u.hostname, port: u.port || "5432" };
  } catch {
    return null;
  }
}

function readDailyDbUrl(): string | null {
  try {
    const home = process.env.FREEANIMA_HOME ?? join(process.env.HOME ?? "~", ".anima");
    const yaml = readFileSync(join(home, "config.yaml"), "utf-8");
    const match = yaml.match(/^\s*url:\s*(.+)$/m);
    const raw = match?.[1]?.trim();
    if (!raw) return null;
    let url = raw;
    const envMatch = url.match(/^env\("([^"]+)"\)$/);
    if (envMatch?.[1]) url = process.env[envMatch[1]] ?? "";
    return url || null;
  } catch {
    return null;
  }
}

/** 与日常 config.yaml 同 host:port → 拒绝（防 DROP/迁移日常库） */
export function assertNotDailyPgUrl(url: string): void {
  const dailyUrl = readDailyDbUrl();
  if (!dailyUrl) return;
  const daily = parseHostPort(dailyUrl);
  const test = parseHostPort(url);
  if (!daily || !test) return;
  if (daily.host === test.host && daily.port === test.port) {
    throw new Error(
      `ANIMA_TEST_PG_URL host:port (${test.host}:${test.port}) matches daily ~/.anima/config.yaml — refusing to touch it. Use just qa test-integration (Docker).`,
    );
  }
}

function assertDockerAvailable(): void {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "Integration tests require Docker to be running. Start Docker and retry: bun test",
    );
  }
}

function ensurePgExtensions(url: string): void {
  const extensionsPath = join(dbRoot, "scripts/ensure-pg-extensions.sql");
  execSync(`psql "${url}" -v ON_ERROR_STOP=1 -f "${extensionsPath}"`, {
    stdio: "inherit",
  });
}

async function runMigrations(url: string): Promise<void> {
  ensurePgExtensions(url);
  const { initDatabase, getDb, closeDb } = await import(join(repoRoot, "src/core/db/pg/client.ts"));
  const { runMigrations: applyMigrations } = await import(join(repoRoot, "src/core/db/index.ts"));
  initDatabase({ getDatabaseUrl: () => url });
  try {
    await applyMigrations(getDb());
  } finally {
    await closeDb();
  }
}

async function waitForPostgres(port: string, maxAttempts = 60): Promise<void> {
  const url = `postgres://test:test@127.0.0.1:${port}/postgres`;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`psql "${url}" -c "SELECT 1"`, { stdio: "ignore" });
      return;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("PostgreSQL container did not become ready within the timeout");
}

/** 维护库 URL（…/postgres）；各 worker 从 ANIMA_TEST_PG_URL 读取 */
export function getContainerBaseUrl(): string {
  const url = process.env.ANIMA_TEST_PG_URL?.trim();
  if (!url) throw new Error("ANIMA_TEST_PG_URL is not set");
  return url.replace(/\/[^/?]*(\?.*)?$/, "/postgres");
}

function dbUrlFor(base: string, dbName: string): string {
  return base.replace(/\/[^/?]*(\?.*)?$/, `/${dbName}`);
}

/** 从模板库克隆独立数据库（不做 migrate）。库名：anima_it_<slug> */
export function createIsolatedTestDb(fileSlug: string): string {
  const base = getContainerBaseUrl();
  assertNotDailyPgUrl(base);
  const dbName = `anima_it_${fileSlug}`;
  execSync(
    `psql "${base}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)"`,
    {
      stdio: "ignore",
    },
  );
  execSync(
    `psql "${base}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${dbName} TEMPLATE ${TEMPLATE_DB}"`,
    { stdio: "ignore" },
  );
  return dbUrlFor(base, dbName);
}

export function dropIsolatedTestDb(fileSlug: string): void {
  try {
    const base = getContainerBaseUrl();
    assertNotDailyPgUrl(base);
    const dbName = `anima_it_${fileSlug}`;
    execSync(`psql "${base}" -c "DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)"`, {
      stdio: "ignore",
    });
  } catch {
    // ignore cleanup failure
  }
}

async function prepareTemplateDb(baseUrl: string): Promise<void> {
  assertNotDailyPgUrl(baseUrl);
  execSync(
    `psql "${baseUrl}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS ${TEMPLATE_DB} WITH (FORCE)"`,
    { stdio: "ignore" },
  );
  execSync(`psql "${baseUrl}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE ${TEMPLATE_DB}"`, {
    stdio: "ignore",
  });
  const templateUrl = dbUrlFor(baseUrl, TEMPLATE_DB);
  await runMigrations(templateUrl);
  execSync(
    `psql "${baseUrl}" -v ON_ERROR_STOP=1 -c "ALTER DATABASE ${TEMPLATE_DB} IS_TEMPLATE true"`,
    { stdio: "ignore" },
  );
  execSync(
    `psql "${baseUrl}" -v ON_ERROR_STOP=1 -c "ALTER DATABASE ${TEMPLATE_DB} ALLOW_CONNECTIONS false"`,
    { stdio: "ignore" },
  );
}

/** Start PG、建模板库、设 ANIMA_TEST_PG_URL（须在 spawn bun test 之前调用） */
export async function setupIntegrationPg(): Promise<() => Promise<void>> {
  const presetUrl = process.env.ANIMA_TEST_PG_URL?.trim();
  if (presetUrl) {
    assertNotDailyPgUrl(presetUrl);
    const baseUrl = presetUrl.replace(/\/[^/?]*(\?.*)?$/, "/postgres");
    process.env.ANIMA_TEST_PG_URL = baseUrl;
    await prepareTemplateDb(baseUrl);
    return async () => {};
  }

  assertDockerAvailable();
  const containerId = execSync(
    "docker run -d -p 0:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=postgres pgvector/pgvector:pg17",
    { encoding: "utf-8" },
  ).trim();
  try {
    const portLine = execSync(`docker port ${containerId} 5432/tcp`, {
      encoding: "utf-8",
    }).trim();
    const port = portLine.split(":").at(-1);
    if (!port) {
      throw new Error(`failed to parse PostgreSQL mapped port: ${portLine}`);
    }
    await waitForPostgres(port);
    const baseUrl = `postgres://test:test@127.0.0.1:${port}/postgres`;
    process.env.ANIMA_TEST_PG_URL = baseUrl;
    await prepareTemplateDb(baseUrl);
  } catch (err) {
    try {
      execSync(`docker rm -f ${containerId}`, { stdio: "ignore" });
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }

  return async () => {
    execSync(`docker rm -f ${containerId}`, { stdio: "ignore" });
  };
}
