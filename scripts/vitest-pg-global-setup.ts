import { execSync } from "node:child_process";
import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

import { PG_TEST_URL_FILE } from "./vitest-pg-constants.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const dbRoot = join(repoRoot, "packages/db");

function assertDockerAvailable(): void {
  try {
    execSync("docker info", { stdio: "ignore" });
  } catch {
    throw new Error(
      "集成测试需要 Docker 运行中。请启动 Docker 后重试：pnpm test:integration",
    );
  }
}

/** 用 psql 执行 migration SQL（避免 globalSetup 依赖 workspace 包解析） */
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

function persistTestUrl(url: string): void {
  writeFileSync(PG_TEST_URL_FILE, url, "utf-8");
  process.env.ANIMA_TEST_PG_URL = url;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const presetUrl = process.env.ANIMA_TEST_PG_URL?.trim();
  if (presetUrl) {
    persistTestUrl(presetUrl);
    runMigrations(presetUrl);
    return async () => {
      try {
        unlinkSync(PG_TEST_URL_FILE);
      } catch {
        /* ignore */
      }
    };
  }

  assertDockerAvailable();
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();
  const url = container.getConnectionUri();
  persistTestUrl(url);
  runMigrations(url);

  return async () => {
    await container.stop();
    try {
      unlinkSync(PG_TEST_URL_FILE);
    } catch {
      /* ignore */
    }
  };
}
