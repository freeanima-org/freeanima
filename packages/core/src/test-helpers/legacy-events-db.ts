import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** 测试用：写入 Python 时代 events 表（data 列）的一条 pending 事件 */
export function seedLegacyPythonStyleEvent(
  dbPath: string,
  topic: string,
  payload: Record<string, unknown>,
): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
  db
    .prepare(
      `INSERT INTO events (topic, data, created_at, status) VALUES (?, ?, ?, 'pending')`,
    )
    .run(topic, JSON.stringify(payload), new Date().toISOString());
  db.close();
}
