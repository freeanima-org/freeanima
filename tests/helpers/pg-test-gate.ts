import { bindEnginePorts } from "@freeanima/host/platform";

bindEnginePorts();

import { describe } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PG integration test gate.
 *
 * `bun test` injects `ANIMA_TEST_PG_URL` (Docker CLI starts a temp PG).
 * Skips when URL is unset (e.g. unit-test-only `bun test` path).
 *
 * 护栏：若 ANIMA_TEST_PG_URL 与日常 ~/.anima/config.yaml (FREEANIMA_HOME)
 * 的 database.url **host:port 相同**，则整包 skip（零副作用，不清任何表）。
 * Docker 临时容器使用随机高位端口，与日常 5432 天然不同，不受影响。
 */

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
    // 展开 env("VAR") 引用
    const envMatch = url.match(/^env\("([^"]+)"\)$/);
    if (envMatch?.[1]) url = process.env[envMatch[1]] ?? "";
    return url || null;
  } catch {
    return null;
  }
}

function isDailyDbUrl(testUrl: string): boolean {
  const dailyUrl = readDailyDbUrl();
  if (!dailyUrl) return false;
  const daily = parseHostPort(dailyUrl);
  const test = parseHostPort(testUrl);
  if (!daily || !test) return false;
  return daily.host === test.host && daily.port === test.port;
}

export const pgTestUrl = process.env.ANIMA_TEST_PG_URL;

const guardBlocked = pgTestUrl ? isDailyDbUrl(pgTestUrl) : false;

if (guardBlocked) {
  console.warn(
    "[pg-test-gate] WARN: ANIMA_TEST_PG_URL 与日常 config.yaml database.url 的 host:port 相同，" +
      "PG 集成测试已全部 skip 以保护日常数据。请改用 Docker 临时库（just qa test-integration）。",
  );
}

export const describePg = pgTestUrl && !guardBlocked ? describe : describe.skip;
