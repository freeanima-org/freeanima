import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export type SqliteRunResult = { changes: number };

export type SqliteStatement = {
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
  run(...params: unknown[]): SqliteRunResult;
};

export type SqliteDatabase = {
  pragma(setting: string): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
  close(): void;
};

/** Bun 用 bun:sqlite，Node 用 better-sqlite3（避免 Bun 加载原生模块） */
export function openSqlite(path: string): SqliteDatabase {
  if (typeof Bun !== "undefined") {
    const { openBunSqlite } = require("./sqlite-bun.js") as typeof import("./sqlite-bun.js");
    return openBunSqlite(path);
  }
  const { openNodeSqlite } = require("./sqlite-node.js") as typeof import("./sqlite-node.js");
  return openNodeSqlite(path);
}
