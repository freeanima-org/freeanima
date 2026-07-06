import { it, expect, beforeAll, beforeEach, afterEach } from "bun:test";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describePg, pgTestUrl } from "../../helpers/pg-test-gate.ts";
import { beginLogIsolation } from "../../helpers/log-isolation.ts";
import { restoreIntegrationHome } from "../../helpers/integration-case.ts";
import { writeIntegrationDatabaseConfig } from "../../helpers/pg-test.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const publishRoot = join(repoRoot, "src/app/cli/publish");
const cliJs = join(publishRoot, "dist/cli.js");
const TEST_PORT = 18_658;
const HEALTH_TIMEOUT_MS = 120_000;

function assertPublishedCliBuilt(): void {
  if (existsSync(cliJs)) return;
  throw new Error(
    "cli/publish/dist/cli.js 不存在；请先运行 `bun run build:cli`（CI Quality 作业会在集成测试前构建）",
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
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
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

describePg("published CLI HTTP health", () => {
  const prevHome = process.env.FREEANIMA_HOME;
  let child: ChildProcess | null = null;
  let home = "";

  beforeAll(() => {
    assertPublishedCliBuilt();
  });

  beforeEach(() => {
    if (!pgTestUrl) throw new Error("ANIMA_TEST_PG_URL is not set");
    home = beginLogIsolation("published-cli-serve-");
    writeIntegrationDatabaseConfig(home, pgTestUrl);

    child = spawn(
      process.execPath,
      [cliJs, "service", "start", "--foreground", "--port", String(TEST_PORT)],
      {
        env: {
          ...process.env,
          FREEANIMA_HOME: home,
          FREEANIMA_REPO_ROOT: publishRoot,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    child.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString();
      if (line.includes("[startup]") || line.includes("Error")) {
        process.stderr.write(`[published-cli-serve] ${line}`);
      }
    });
  });

  afterEach(async () => {
    stopChild(child);
    child = null;
    await sleep(300);
    restoreIntegrationHome(prevHome);
  });

  it(
    "GET /api/health returns status ok from publish bundle",
    async () => {
      const body = await waitForHealth(TEST_PORT);
      expect(body.status).toBe("ok");
      expect(typeof body.version).toBe("string");
    },
    HEALTH_TIMEOUT_MS,
  );
});
