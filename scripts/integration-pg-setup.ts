import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = join(repoRoot, "core");

function assertDockerAvailable(): void {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "Integration tests require Docker to be running. Start Docker and retry: bun test",
    );
  }
}

/** Pre-install extensions on test DB superuser (vector is not in migrations; see ensure-pg-extensions.sql) */
function ensurePgExtensions(url: string): void {
  const extensionsPath = join(dbRoot, "scripts/ensure-pg-extensions.sql");
  execSync(`psql "${url}" -v ON_ERROR_STOP=1 -f "${extensionsPath}"`, {
    stdio: "inherit",
  });
}

/** 通过 Drizzle migrator 应用迁移（与运行时 runMigrations 共用 journal，避免 psql 直跑后子进程重复建表） */
async function runMigrations(url: string): Promise<void> {
  ensurePgExtensions(url);
  const { initDatabase, getDb, closeDb } = await import(
    join(repoRoot, "platform/connectors/db-pg/index.ts")
  );
  const { runMigrations: applyMigrations } = await import(join(repoRoot, "core/src/db/index.ts"));
  initDatabase({ getDatabaseUrl: () => url });
  try {
    await applyMigrations(getDb());
  } finally {
    await closeDb();
  }
}

async function waitForPostgres(port: string, maxAttempts = 60): Promise<void> {
  const url = `postgres://test:test@127.0.0.1:${port}/test`;
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

/** Start PG and set `ANIMA_TEST_PG_URL` (must be called before spawning bun test subprocesses) */
export async function setupIntegrationPg(): Promise<() => Promise<void>> {
  const presetUrl = process.env.ANIMA_TEST_PG_URL?.trim();
  if (presetUrl) {
    process.env.ANIMA_TEST_PG_URL = presetUrl;
    await runMigrations(presetUrl);
    return async () => {};
  }

  assertDockerAvailable();
  // Skip Testcontainers: dockerode → ssh2 NAPI triggers uv_version_string crash on Bun / Node exit
  const containerId = execSync(
    "docker run -d -p 0:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test pgvector/pgvector:pg17",
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
    const url = `postgres://test:test@127.0.0.1:${port}/test`;
    process.env.ANIMA_TEST_PG_URL = url;
    await runMigrations(url);
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
