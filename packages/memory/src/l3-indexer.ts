import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PATHS, openSqlite, type SqliteDatabase } from "@freeanima/legacy-kernel";
import { buildFtsQuery } from "./fts-query";
import { getStore } from "./store";
import type { FactData } from "./fact";
import {
  l3DomainsSchema,
  l3EntitiesSchema,
  l3SourcesSchema,
} from "@freeanima/legacy-kernel";
import { safeParseOrNull } from "@freeanima/legacy-kernel";

const SCHEMA = `
CREATE VIRTUAL TABLE IF NOT EXISTS l3_facts_fts USING fts5(
    content,
    fact_id    UNINDEXED,
    type       UNINDEXED,
    domains    UNINDEXED,
    entities   UNINDEXED,
    tokenize='unicode61'
);
CREATE TABLE IF NOT EXISTS l3_facts_meta (
    fact_id     TEXT PRIMARY KEY,
    type        TEXT NOT NULL,
    confidence  REAL NOT NULL DEFAULT 0.5,
    importance  REAL NOT NULL DEFAULT 0.5,
    recall      REAL NOT NULL DEFAULT 0.5,
    domains     TEXT NOT NULL DEFAULT '[]',
    entities    TEXT NOT NULL DEFAULT '[]',
    threads     TEXT NOT NULL DEFAULT '[]',
    sources     TEXT NOT NULL DEFAULT '[]',
    content     TEXT NOT NULL,
    mtime       REAL NOT NULL,
    created     TEXT NOT NULL,
    updated     TEXT NOT NULL
);
`;

function dbPath(): string {
  return join(PATHS.index, "l3.db");
}

function getConn(): SqliteDatabase {
  mkdirSync(PATHS.index, { recursive: true });
  const conn = openSqlite(dbPath());
  conn.pragma("journal_mode = WAL");
  conn.exec(SCHEMA);
  return conn;
}

function indexOne(conn: SqliteDatabase, fact: FactData): void {
  const factPath = join(PATHS.memory, `${fact.id}.md`);
  const mtime = existsSync(factPath) ? statSync(factPath).mtimeMs : 0;
  const domainsStr = JSON.stringify(fact.domains);
  const entitiesStr = JSON.stringify(fact.entities);
  const threadsStr = JSON.stringify(fact.threads);
  const sourcesStr = JSON.stringify(fact.sources);

  conn.prepare("DELETE FROM l3_facts_fts WHERE fact_id = ?").run(fact.id);
  conn
    .prepare(
      "INSERT INTO l3_facts_fts(content, fact_id, type, domains, entities) VALUES (?, ?, ?, ?, ?)",
    )
    .run(fact.content, fact.id, fact.type, domainsStr, entitiesStr);
  conn
    .prepare(
      `INSERT OR REPLACE INTO l3_facts_meta
       (fact_id, type, confidence, importance, recall, domains, entities, threads, sources, content, mtime, created, updated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fact.id,
      fact.type,
      fact.confidence,
      fact.importance,
      fact.recall,
      domainsStr,
      entitiesStr,
      threadsStr,
      sourcesStr,
      fact.content,
      mtime,
      fact.created,
      fact.updated,
    );
}

export function indexL3Fact(fact: FactData): number {
  if (!fact.id) return 0;
  const conn = getConn();
  try {
    indexOne(conn, fact);
    return 1;
  } finally {
    conn.close();
  }
}

/** 批量索引指定事实（单次连接）；热路径用，全量重建请用 indexL3All */
export function indexL3Facts(factIds: string[]): number {
  if (!factIds.length) return 0;
  const store = getStore();
  const conn = getConn();
  let count = 0;
  try {
    const seen = new Set<string>();
    for (const id of factIds) {
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const fact = store.get(id);
      if (!fact) continue;
      indexOne(conn, fact);
      count++;
    }
    return count;
  } finally {
    conn.close();
  }
}

export function indexL3All(opts?: { dropFirst?: boolean }): number {
  const store = getStore();
  const allFacts = store.filter();
  const conn = getConn();
  try {
    if (opts?.dropFirst) {
      conn.exec("DELETE FROM l3_facts_fts; DELETE FROM l3_facts_meta;");
    }
    let count = 0;
    for (const fact of allFacts) {
      indexOne(conn, fact);
      count++;
    }
    return count;
  } finally {
    conn.close();
  }
}

export type L3SearchRow = {
  fact_id: string;
  content: string;
  type: string;
  confidence: number;
  importance: number;
  recall: number;
  domains: string[];
  entities: string[];
  sources: Record<string, unknown>[];
  rank: number;
};

export function removeL3Fact(factId: string): boolean {
  if (!factId) return false;
  const conn = getConn();
  try {
    const ftsResult = conn.prepare("DELETE FROM l3_facts_fts WHERE fact_id = ?").run(factId);
    conn.prepare("DELETE FROM l3_facts_meta WHERE fact_id = ?").run(factId);
    return ftsResult.changes > 0;
  } finally {
    conn.close();
  }
}

export function searchL3Fts(query: string, limit = 10): L3SearchRow[] {
  if (!existsSync(dbPath())) return [];
  const conn = getConn();
  try {
    const ftsQuery = buildFtsQuery(query);
    const sql = `
      SELECT m.fact_id, m.type, m.content, m.confidence, m.importance, m.recall,
             m.domains, m.entities, m.sources, rank
      FROM l3_facts_fts f
      JOIN l3_facts_meta m ON f.fact_id = m.fact_id
      WHERE l3_facts_fts MATCH ?
      ORDER BY rank
      LIMIT ?`;
    const rows = conn.prepare(sql).all(ftsQuery, limit) as Array<{
      fact_id: string;
      type: string;
      content: string;
      confidence: number;
      importance: number;
      recall: number;
      domains: string;
      entities: string;
      sources: string;
      rank: number;
    }>;

    return rows.map((r) => ({
      fact_id: r.fact_id,
      content: r.content,
      type: r.type,
      confidence: r.confidence,
      importance: r.importance,
      recall: r.recall,
      domains: safeParseOrNull(l3DomainsSchema, JSON.parse(r.domains)) ?? [],
      entities: safeParseOrNull(l3EntitiesSchema, JSON.parse(r.entities)) ?? [],
      sources: safeParseOrNull(l3SourcesSchema, JSON.parse(r.sources)) ?? [],
      rank: r.rank,
    }));
  } finally {
    conn.close();
  }
}
