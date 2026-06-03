import Database from "better-sqlite3";

import type { SqliteDatabase } from "./sqlite";

export function openNodeSqlite(path: string): SqliteDatabase {
  const db = new Database(path);
  return {
    pragma(setting: string): void {
      db.pragma(setting);
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      return {
        all(...params: unknown[]) {
          return stmt.all(...params) as unknown[];
        },
        get(...params: unknown[]) {
          return stmt.get(...params);
        },
        run(...params: unknown[]) {
          return { changes: stmt.run(...params).changes };
        },
      };
    },
    close(): void {
      db.close();
    },
  };
}
