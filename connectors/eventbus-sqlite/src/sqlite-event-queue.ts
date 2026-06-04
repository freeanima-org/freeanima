import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { DispatchOutcome, EventQueueAdapter, StoredEvent } from "@freeanima/kernel-eventbus";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  topic       TEXT NOT NULL,
  data        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  retries     INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_pending ON events(status, id);
`;

const MAX_RETRIES = 3;

export type SqliteEventQueueOptions = {
  pollMs?: number;
};

function tableColumns(db: Database): Set<string> {
  const rows = db.prepare("PRAGMA table_info(events)").all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** 与 Python EventBus 共用 events.db schema */
function migrateEventsSchema(db: Database): void {
  db.exec(SCHEMA);
  const cols = tableColumns(db);
  if (!cols.size) return;

  if (cols.has("payload") && !cols.has("data")) {
    db.exec("ALTER TABLE events RENAME COLUMN payload TO data");
  }
  if (!cols.has("retries")) {
    db.exec("ALTER TABLE events ADD COLUMN retries INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("last_error")) {
    db.exec("ALTER TABLE events ADD COLUMN last_error TEXT");
  }
}

function parsePayload(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** SQLite 持久化事件队列（bun:sqlite）；start 内 resetStuck + 轮询 */
export class SqliteEventQueue implements EventQueueAdapter {
  private readonly db: Database;
  private readonly pollMs: number;
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private process: ((event: StoredEvent) => Promise<DispatchOutcome>) | null = null;

  constructor(dbPath: string, opts?: SqliteEventQueueOptions) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    migrateEventsSchema(this.db);
    this.pollMs = opts?.pollMs ?? 500;
  }

  enqueue(topicQualifiedId: string, payload: unknown): void {
    this.db
      .prepare(`INSERT INTO events (topic, data, created_at, status) VALUES (?, ?, ?, 'pending')`)
      .run(topicQualifiedId, JSON.stringify(payload), new Date().toISOString());
  }

  start(process: (event: StoredEvent) => Promise<DispatchOutcome>): void {
    if (this.running) return;
    this.resetStuck();
    this.process = process;
    this.running = true;
    this.timer = setInterval(() => void this.poll(), this.pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private resetStuck(): void {
    this.db
      .prepare(
        `UPDATE events SET status = 'pending', retries = retries + 1,
         last_error = 'worker restarted while running' WHERE status = 'running'`,
      )
      .run();
  }

  private async poll(): Promise<void> {
    if (!this.running || !this.process) return;

    const row = this.db
      .prepare(
        `SELECT id, topic, data, retries FROM events WHERE status = 'pending' ORDER BY id LIMIT 1`,
      )
      .get() as { id: number; topic: string; data: string; retries: number } | undefined;
    if (!row) return;

    this.db.prepare(`UPDATE events SET status = 'running' WHERE id = ?`).run(row.id);
    const payload = parsePayload(row.data);
    if (payload === null) {
      this.db
        .prepare(
          `UPDATE events SET status = 'failed', last_error = ?, retries = retries + 1 WHERE id = ?`,
        )
        .run("invalid event payload JSON", row.id);
      return;
    }

    const stored: StoredEvent = {
      id: row.id,
      topicQualifiedId: row.topic,
      payload,
    };

    try {
      const outcome = await this.process(stored);
      this.applyOutcome(row.id, row.retries, outcome, null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.applyOutcome(row.id, row.retries, "retry", msg);
    }
  }

  private applyOutcome(
    id: number,
    retries: number,
    outcome: DispatchOutcome,
    errorMessage: string | null,
  ): void {
    if (outcome === "ack") {
      this.db.prepare(`UPDATE events SET status = 'done' WHERE id = ?`).run(id);
      return;
    }

    const msg = errorMessage ?? "dispatch failed";
    if (outcome === "fail" || retries >= MAX_RETRIES) {
      this.db
        .prepare(
          `UPDATE events SET status = 'failed', last_error = ?, retries = retries + 1 WHERE id = ?`,
        )
        .run(msg, id);
      return;
    }

    this.db
      .prepare(
        `UPDATE events SET status = 'pending', retries = retries + 1, last_error = ? WHERE id = ?`,
      )
      .run(msg, id);
  }
}
