import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = join(repoRoot, "engine/db");

function assertDockerAvailable(): void {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error("集成测试需要 Docker 运行中。请启动 Docker 后重试：bun test");
  }
}

/** 用 psql 执行 migration SQL（避免 setup 依赖 workspace 包解析） */
function runMigrations(url: string): void {
  const migrationsDir = join(dbRoot, "migrations");
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .toSorted();
  for (const dir of dirs) {
    const migrationPath = join(migrationsDir, dir, "migration.sql");
    execSync(`psql "${url}" -v ON_ERROR_STOP=1 -f "${migrationPath}"`, {
      stdio: "inherit",
    });
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
  throw new Error("PostgreSQL 容器在超时内未就绪");
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
  // 不用 Testcontainers：其 dockerode → ssh2 NAPI 在 Bun / Node 退出时会触发 uv_version_string 崩溃
  const containerId = execSync(
    "docker run -d -p 0:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test postgres:17-alpine",
    { encoding: "utf-8" },
  ).trim();
  try {
    const portLine = execSync(`docker port ${containerId} 5432/tcp`, {
      encoding: "utf-8",
    }).trim();
    const port = portLine.split(":").at(-1);
    if (!port) {
      throw new Error(`无法解析 PostgreSQL 映射端口: ${portLine}`);
    }
    await waitForPostgres(port);
    const url = `postgres://test:test@127.0.0.1:${port}/test`;
    process.env.ANIMA_TEST_PG_URL = url;
    runMigrations(url);
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
