/// <reference types="bun-types" />
import { Database, type SQLQueryBindings } from "bun:sqlite";

import type { SqliteDatabase } from "./sqlite.js";

function bindParams(params: unknown[]): SQLQueryBindings[] {
  return params as SQLQueryBindings[];
}

export function openBunSqlite(path: string): SqliteDatabase {
  const db = new Database(path, { create: true });
  return {
    pragma(setting: string): void {
      db.exec(`PRAGMA ${setting}`);
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        all(...params: unknown[]) {
          return stmt.all(...bindParams(params)) as unknown[];
        },
        get(...params: unknown[]) {
          return stmt.get(...bindParams(params));
        },
        run(...params: unknown[]) {
          return { changes: stmt.run(...bindParams(params)).changes };
        },
      };
    },
    close(): void {
      db.close();
    },
  };
}
