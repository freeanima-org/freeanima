import { openBunSqlite } from "./sqlite-bun";

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

/** 打开 SQLite（bun:sqlite；运行时要求 Bun） */
export function openSqlite(path: string): SqliteDatabase {
  return openBunSqlite(path);
}
