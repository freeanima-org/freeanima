import { describe, expect, it } from "bun:test";
import {
  formatPgStartupError,
  parseDatabaseEndpointFromUrl,
  parseDatabaseNameFromUrl,
} from "./startup-error.ts";

const DB_URL = "postgresql://anima:secret@127.0.0.1:5432/anima_9527";

function drizzleWithPgCause(message: string, code?: string): Error {
  const drizzle = new Error('Failed query: CREATE SCHEMA IF NOT EXISTS "drizzle"');
  drizzle.name = "DrizzleQueryError";
  const pg = new Error(message);
  pg.name = "PostgresError";
  if (code) {
    (pg as Error & { code: string }).code = code;
  }
  drizzle.cause = pg;
  return drizzle;
}

describe("parseDatabaseNameFromUrl", () => {
  it("从 URL 解析库名", () => {
    expect(parseDatabaseNameFromUrl(DB_URL)).toBe("anima_9527");
  });

  it("非法 URL 返回 null", () => {
    expect(parseDatabaseNameFromUrl("not-a-url")).toBeNull();
  });
});

describe("parseDatabaseEndpointFromUrl", () => {
  it("从 URL 解析 host:port", () => {
    expect(parseDatabaseEndpointFromUrl(DB_URL)).toBe("127.0.0.1:5432");
  });
});

describe("formatPgStartupError", () => {
  it("缺库时提示建库或改配置", () => {
    const err = formatPgStartupError(
      drizzleWithPgCause('database "anima_9527" does not exist', "3D000"),
      { databaseUrl: DB_URL },
    );
    expect(err.name).toBe("PgStartupError");
    expect(err.message).toContain('数据库 "anima_9527" 不存在');
    expect(err.message).toContain("createdb");
    expect(err.message).not.toContain("secret");
    expect(err.cause).toBeInstanceOf(Error);
  });

  it("鉴权失败时提示核对凭据", () => {
    const err = formatPgStartupError(
      drizzleWithPgCause('password authentication failed for user "anima"', "28P01"),
      { databaseUrl: DB_URL },
    );
    expect(err.message).toContain("无法使用当前凭据连接");
    expect(err.message).toContain("127.0.0.1:5432");
    expect(err.message).toContain("env()");
  });

  it("连接被拒时提示检查服务与地址", () => {
    const root = new Error("connect ECONNREFUSED 127.0.0.1:5432");
    (root as Error & { code: string }).code = "ECONNREFUSED";
    const err = formatPgStartupError(root, { databaseUrl: DB_URL });
    expect(err.message).toContain("无法连接到 PostgreSQL");
    expect(err.message).toContain("systemctl status postgresql");
  });

  it("缺扩展时提示 ensure-pg-extensions.sql", () => {
    const err = formatPgStartupError(drizzleWithPgCause('extension "vector" does not exist'), {
      databaseUrl: DB_URL,
    });
    expect(err.message).toContain("缺少必需扩展");
    expect(err.message).toContain("ensure-pg-extensions.sql");
  });

  it("未知错误保留摘要并指向文档", () => {
    const err = formatPgStartupError(new Error("something unexpected"), { databaseUrl: DB_URL });
    expect(err.message).toContain("PostgreSQL 启动检查失败");
    expect(err.message).toContain("something unexpected");
    expect(err.message).toContain("Troubleshooting");
  });
});
