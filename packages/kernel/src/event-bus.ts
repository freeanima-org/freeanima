import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { logError } from "./error-log";
import { PATHS } from "./paths";
import type { EventMap, EventTopic } from "./schemas/events";
import { eventPayloadSchemas } from "./schemas/events";
import { openSqlite, type SqliteDatabase } from "./sqlite";

type Handler<T> = (payload: T) => void | Promise<void>;

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

function tableColumns(db: SqliteDatabase): Set<string> {
  const rows = db.prepare("PRAGMA table_info(events)").all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

/** 与 Python EventBus 共用 ~/.anima/runtime/events.db */
function migrateEventsSchema(db: SqliteDatabase): void {
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

function parseEventPayload(topic: string, raw: string): unknown | null {
  try {
    const data: unknown = JSON.parse(raw);
    const schema = eventPayloadSchemas[topic as EventTopic];
    if (!schema) return data;
    const result = schema.safeParse(data);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export class EventBus {
  private db: SqliteDatabase;
  private handlers = new Map<string, Handler<unknown>[]>();
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(dbPath = PATHS.eventsDb) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = openSqlite(dbPath);
    this.db.pragma("journal_mode = WAL");
    migrateEventsSchema(this.db);
  }

  on<K extends EventTopic>(topic: K, handler: Handler<EventMap[K]>): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler as Handler<unknown>);
    this.handlers.set(topic, list);
  }

  emit<K extends EventTopic>(topic: K, payload: EventMap[K]): void {
    this.db
      .prepare(
        `INSERT INTO events (topic, data, created_at, status) VALUES (?, ?, ?, 'pending')`,
      )
      .run(topic, JSON.stringify(payload), new Date().toISOString());
  }

  start(pollMs = 500): void {
    if (this.running) return;
    this.running = true;
    this.timer = setInterval(() => void this.poll(), pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async poll(): Promise<void> {
    const row = this.db
      .prepare(
        `SELECT id, topic, data, retries FROM events WHERE status = 'pending' ORDER BY id LIMIT 1`,
      )
      .get() as { id: number; topic: string; data: string; retries: number } | undefined;
    if (!row) return;

    this.db.prepare(`UPDATE events SET status = 'running' WHERE id = ?`).run(row.id);
    const payload = parseEventPayload(row.topic, row.data);
    const list = this.handlers.get(row.topic) ?? [];

    if (!list.length) {
      this.db.prepare(`UPDATE events SET status = 'done' WHERE id = ?`).run(row.id);
      return;
    }

    if (payload === null) {
      this.db
        .prepare(
          `UPDATE events SET status = 'failed', last_error = ?, retries = retries + 1 WHERE id = ?`,
        )
        .run("invalid event payload JSON", row.id);
      return;
    }

    try {
      for (const h of list) await h(payload);
      this.db.prepare(`UPDATE events SET status = 'done' WHERE id = ?`).run(row.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(`Event handler failed for topic ${row.topic}`, {
        source: "event-bus",
        context: { event_id: row.id, topic: row.topic },
        error: err,
      });
      if (row.retries >= MAX_RETRIES) {
        this.db
          .prepare(
            `UPDATE events SET status = 'failed', last_error = ?, retries = retries + 1 WHERE id = ?`,
          )
          .run(msg, row.id);
      } else {
        this.db
          .prepare(
            `UPDATE events SET status = 'pending', retries = retries + 1, last_error = ? WHERE id = ?`,
          )
          .run(msg, row.id);
      }
    }
  }

  /** 启动时将 running 事件重置为 pending（进程崩溃恢复，对齐 Python） */
  resetStuck(): void {
    this.db
      .prepare(
        `UPDATE events SET status = 'pending', retries = retries + 1,
         last_error = 'worker restarted while running' WHERE status = 'running'`,
      )
      .run();
  }
}

export type { EventMap, EventTopic } from "./schemas/events";
