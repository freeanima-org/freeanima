import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { openSqlite, type SqliteDatabase } from "@freeanima/connectors-sqlite";

/** 打开 FTS 索引库（WAL + schema 初始化） */
export function openIndexDb(dbFileName: string, schema: string): SqliteDatabase {
  mkdirSync(PATHS.index, { recursive: true });
  const conn = openSqlite(join(PATHS.index, dbFileName));
  conn.pragma("journal_mode = WAL");
  conn.exec(schema);
  return conn;
}
