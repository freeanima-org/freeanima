import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { PATHS, openSqlite, type SqliteDatabase } from "@freeanima/legacy-kernel";
import { buildFtsQuery } from "./fts-query";
import { l2SessionPath } from "./clean";
import { l2LineSchema } from "@freeanima/legacy-kernel";
import { parseJsonLine } from "@freeanima/legacy-kernel";

const SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS l2_messages_fts USING fts5(
    content,
    role       UNINDEXED,
    session_id UNINDEXED,
    timestamp  UNINDEXED,
    tokenize='unicode61'
);
CREATE TABLE IF NOT EXISTS l2_index_meta (
    file_path    TEXT PRIMARY KEY,
    mtime        REAL NOT NULL,
    row_count    INTEGER NOT NULL DEFAULT 0,
    last_indexed TEXT NOT NULL
);
`;

function dbPath(): string {
  return join(PATHS.index, "l2.db");
}

function getConn(): SqliteDatabase {
  mkdirSync(PATHS.index, { recursive: true });
  const conn = openSqlite(dbPath());
  conn.pragma("journal_mode = WAL");
  conn.exec(SCHEMA);
  return conn;
}

export function indexL2Session(sessionId: string): number {
  const l2Path = l2SessionPath(sessionId);
  if (!existsSync(l2Path)) return -1;

  const mtime = statSync(l2Path).mtimeMs;
  const conn = getConn();
  try {
    const row = conn
      .prepare("SELECT mtime FROM l2_index_meta WHERE file_path = ?")
      .get(`${sessionId}.jsonl`) as { mtime: number } | undefined;
    if (row && row.mtime >= mtime) return 0;

    conn.prepare("DELETE FROM l2_messages_fts WHERE session_id = ?").run(sessionId);

    const rows: [string, string, string, string][] = [];
    const text = readFileSync(l2Path, "utf-8");
    for (const line of text.split("\n")) {
      const record = parseJsonLine(line, l2LineSchema);
      if (!record) continue;
      if (record.type === "meta") continue;
      const content = String(record.content ?? "").trim();
      const role = String(record.role ?? "");
      const ts = String(record.t ?? "");
      if (content) rows.push([content, role, sessionId, ts]);
    }

    if (rows.length) {
      const ins = conn.prepare(
        "INSERT INTO l2_messages_fts(content, role, session_id, timestamp) VALUES (?, ?, ?, ?)",
      );
      for (const r of rows) ins.run(...r);
    }

    conn
      .prepare(
        "INSERT OR REPLACE INTO l2_index_meta(file_path, mtime, row_count, last_indexed) VALUES (?, ?, ?, ?)",
      )
      .run(`${sessionId}.jsonl`, mtime, rows.length, new Date().toISOString());

    return rows.length;
  } finally {
    conn.close();
  }
}

export type L2SearchRow = {
  content: string;
  role: string;
  session_id: string;
  timestamp: string;
  rank: number;
};

export function searchL2(
  query: string,
  opts?: { role?: string; sessionId?: string; limit?: number },
): L2SearchRow[] {
  if (!existsSync(dbPath())) return [];
  const limit = opts?.limit ?? 10;
  const conn = getConn();
  try {
    const ftsQuery = buildFtsQuery(query);
    const conditions = ["l2_messages_fts MATCH ?"];
    const params: (string | number)[] = [ftsQuery];
    if (opts?.role) {
      conditions.push("role = ?");
      params.push(opts.role);
    }
    if (opts?.sessionId) {
      conditions.push("session_id = ?");
      params.push(opts.sessionId);
    }
    params.push(limit);

    const sql = `SELECT content, role, session_id, timestamp, rank FROM l2_messages_fts WHERE ${conditions.join(" AND ")} ORDER BY rank LIMIT ?`;
    const rows = conn.prepare(sql).all(...params) as L2SearchRow[];
    return rows;
  } finally {
    conn.close();
  }
}

/** L2 FTS 索引中的消息行数（库或表不存在时返回 0）。 */
export function countL2FtsRows(): number {
  if (!existsSync(dbPath())) return 0;
  const conn = getConn();
  try {
    const row = conn.prepare("SELECT COUNT(*) AS n FROM l2_messages_fts").get() as { n: number };
    return row?.n ?? 0;
  } catch {
    return 0;
  } finally {
    conn.close();
  }
}

/** 重建 processed/ 下全部 L2 的 FTS 索引。 */
export function reindexL2All(opts?: { dropFirst?: boolean }): number {
  const processedDir = PATHS.processed;
  if (!existsSync(processedDir)) return 0;

  if (opts?.dropFirst) {
    const conn = getConn();
    try {
      conn.prepare("DELETE FROM l2_messages_fts").run();
      conn.prepare("DELETE FROM l2_index_meta").run();
    } finally {
      conn.close();
    }
  }

  let total = 0;
  for (const name of readdirSync(processedDir).toSorted()) {
    if (!name.endsWith(".jsonl")) continue;
    const sid = name.slice(0, -".jsonl".length);
    const n = indexL2Session(sid);
    if (n > 0) total += n;
  }
  return total;
}
