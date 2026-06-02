import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = join(repoRoot, "packages/db");

let stopContainer: (() => Promise<void>) | undefined;

function assertDockerAvailable(): void {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "集成测试需要 Docker 运行中。请启动 Docker 后重试：bun test:integration",
    );
  }
}

/** 用 psql 执行 migration SQL（避免 setup 依赖 workspace 包解析） */
function runMigrations(url: string): void {
  const migrationsDir = join(dbRoot, "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const dir of dirs) {
    const migrationPath = join(migrationsDir, dir, "migration.sql");
    execSync(`psql "${url}" -v ON_ERROR_STOP=1 -f "${migrationPath}"`, {
      stdio: "inherit",
    });
  }
}

/** 启动 PG 并注入 `ANIMA_TEST_PG_URL`（须在 bun test 子进程启动前调用） */
export async function setupIntegrationPg(): Promise<() => Promise<void>> {
  const presetUrl = process.env.ANIMA_TEST_PG_URL?.trim();
  if (presetUrl) {
    process.env.ANIMA_TEST_PG_URL = presetUrl;
    runMigrations(presetUrl);
    return async () => {};
  }

  assertDockerAvailable();
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const url = container.getConnectionUri();
  process.env.ANIMA_TEST_PG_URL = url;
  runMigrations(url);
  stopContainer = () => container.stop();
  return async () => {
    if (stopContainer) {
      await stopContainer();
      stopContainer = undefined;
    }
  };
}
