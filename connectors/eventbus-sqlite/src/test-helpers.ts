import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Unit test poll assertion */
export async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** For tests: write one pending event */
export function seedPendingEvent(
  dbPath: string,
  topic: string,
  payload: Record<string, unknown>,
): void {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new Database(dbPath, { create: true });
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      retries INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );
  `);
  db.prepare(
    `INSERT INTO events (topic, data, created_at, status) VALUES (?, ?, ?, 'pending')`,
  ).run(topic, JSON.stringify(payload), new Date().toISOString());
  db.close();
}
