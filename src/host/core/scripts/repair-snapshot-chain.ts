/**
 * Repair snapshot chain for historical migrations missing snapshot.json (no new migration dir).
 * Usage: bun core/scripts/repair-snapshot-chain.ts
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

type Snapshot = {
  version: string;
  dialect: string;
  id: string;
  prevIds: string[];
  ddl: Record<string, unknown>[];
  renames: unknown[];
};

const MIGRATIONS_DIR = join(import.meta.dir, "../migrations");
const SCHEMA_SNAPSHOT = join(import.meta.dir, "fixtures/drizzle-schema-snapshot.json");

function loadSnapshot(path: string): Snapshot {
  return JSON.parse(readFileSync(path, "utf-8")) as Snapshot;
}

function writeSnapshot(dir: string, snap: Snapshot): void {
  writeFileSync(join(MIGRATIONS_DIR, dir, "snapshot.json"), `${JSON.stringify(snap, null, 2)}\n`);
}

function clone(snap: Snapshot): Snapshot {
  return structuredClone(snap);
}

function nextSnap(prev: Snapshot): Snapshot {
  return {
    version: prev.version,
    dialect: prev.dialect,
    id: randomUUID(),
    prevIds: [prev.id],
    ddl: clone(prev).ddl,
    renames: [],
  };
}

function tableNames(snap: Snapshot): Set<string> {
  return new Set(snap.ddl.filter((e) => e.entityType === "tables").map((e) => String(e.name)));
}

function keepTables(snap: Snapshot, tables: string[]): Snapshot {
  const keep = new Set(tables);
  return {
    ...snap,
    ddl: snap.ddl.filter((e) => {
      const t = e.entityType;
      if (t === "tables") return keep.has(String(e.name));
      if ("table" in e && e.table) return keep.has(String(e.table));
      return false;
    }),
  };
}

function mergeTables(base: Snapshot, full: Snapshot, tables: string[]): Snapshot {
  const chunk = keepTables(full, tables);
  const existing = tableNames(base);
  const additions = chunk.ddl.filter((e) => {
    if (e.entityType === "tables") return !existing.has(String(e.name));
    if ("table" in e && e.table) return !existing.has(String(e.table));
    return true;
  });
  return { ...base, ddl: [...base.ddl, ...additions] };
}

function removeColumn(snap: Snapshot, table: string, column: string): Snapshot {
  return {
    ...snap,
    ddl: snap.ddl.filter(
      (e) => !(e.entityType === "columns" && e.table === table && e.name === column),
    ),
  };
}

function removeIndex(snap: Snapshot, name: string): Snapshot {
  return { ...snap, ddl: snap.ddl.filter((e) => !(e.entityType === "indexes" && e.name === name)) };
}

function col(
  table: string,
  name: string,
  type: string,
  opts: {
    notNull?: boolean;
    default?: string | null;
    generated?: { as: string; type: string } | null;
    dimensions?: number;
  } = {},
): Record<string, unknown> {
  return {
    type,
    typeSchema: null,
    notNull: opts.notNull ?? false,
    dimensions: opts.dimensions ?? 0,
    default: opts.default ?? null,
    generated: opts.generated ?? null,
    identity: null,
    name,
    entityType: "columns",
    schema: "public",
    table,
  };
}

function idx(
  table: string,
  name: string,
  columns: Array<{ value: string }>,
  method: string,
): Record<string, unknown> {
  return {
    nameExplicit: true,
    columns: columns.map((c) => ({
      value: c.value,
      isExpression: false,
      asc: true,
      nullsFirst: false,
      opclass: null,
    })),
    isUnique: false,
    where: null,
    with: "",
    method,
    concurrently: false,
    name,
    entityType: "indexes",
    schema: "public",
    table,
  };
}

function pk(table: string, columns: string[]): Record<string, unknown> {
  return {
    columns,
    nameExplicit: false,
    name: `${table}_pkey`,
    schema: "public",
    table,
    entityType: "pks",
  };
}

function tbl(name: string): Record<string, unknown> {
  return { isRlsEnabled: false, name, entityType: "tables", schema: "public" };
}

function buildSemanticMemoryBasic(): Record<string, unknown>[] {
  return [
    tbl("semantic_memory"),
    col("semantic_memory", "id", "text", { notNull: true }),
    col("semantic_memory", "type", "text", { notNull: true, default: "'world'" }),
    col("semantic_memory", "pinned", "boolean", { notNull: true, default: "false" }),
    col("semantic_memory", "content", "text", { notNull: true }),
    col("semantic_memory", "content_fts", "tsvector", {
      generated: {
        as: 'to_tsvector(\'simple\', message_fts_input("semantic_memory"."content"))',
        type: "stored",
      },
    }),
    col("semantic_memory", "created", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    col("semantic_memory", "updated", "timestamp with time zone", {
      notNull: true,
      default: "now()",
    }),
    idx("semantic_memory", "idx_semantic_memory_fts", [{ value: "content_fts" }], "gin"),
    idx("semantic_memory", "idx_semantic_memory_type", [{ value: "type" }], "btree"),
    idx("semantic_memory", "idx_semantic_memory_pinned", [{ value: "pinned" }], "btree"),
    pk("semantic_memory", ["id"]),
  ];
}

function buildSemanticMemoryProvenanceExtras(full: Snapshot): Record<string, unknown>[] {
  const chunk = keepTables(full, ["semantic_memory"]);
  const names = new Set(["source_conversations", "observed_at", "occurred_at", "status"]);
  return chunk.ddl.filter((e) => {
    if (e.entityType === "columns") return names.has(String(e.name));
    if (e.entityType === "indexes") {
      return ["idx_semantic_memory_source_conversations", "idx_semantic_memory_status"].includes(
        String(e.name),
      );
    }
    return false;
  });
}

function main(): void {
  const full = loadSnapshot(SCHEMA_SNAPSHOT);
  let snap = loadSnapshot(
    join(MIGRATIONS_DIR, "20260606120000_messages_content_fts/snapshot.json"),
  );

  snap = nextSnap(snap);
  snap.ddl.push(...buildSemanticMemoryBasic());
  writeSnapshot("20260606130000_semantic_memory", snap);

  snap = nextSnap(snap);
  snap.ddl.push(...buildSemanticMemoryProvenanceExtras(full));
  writeSnapshot("20260607120000_semantic_memory_provenance", snap);

  // cron_jobs / pg_trgm: migration.sql only, not in Drizzle schema → snapshot ddl unchanged, advance chain only
  snap = nextSnap(snap);
  writeSnapshot("20260607140000_cron_jobs", snap);

  snap = nextSnap(snap);
  snap = mergeTables(snap, full, ["self_blocks", "autobiographical_memory"]);
  writeSnapshot("20260607150000_self_and_autobiographical", snap);

  snap = nextSnap(snap);
  snap = mergeTables(snap, full, ["limbic_memory"]);
  writeSnapshot("20260607160000_limbic_memory", snap);

  snap = nextSnap(snap);
  snap = mergeTables(snap, full, ["tasks"]);
  writeSnapshot("20260608120000_tasks", snap);

  snap = nextSnap(snap);
  writeSnapshot("20260609120000_drop_cron_enabled_toolsets", snap);

  snap = nextSnap(snap);
  const msgChunk = keepTables(full, ["messages"]).ddl.filter((e) => {
    if (e.entityType === "columns") {
      return ["fts_segmented", "content_fts"].includes(String(e.name));
    }
    if (e.entityType === "indexes" && e.name === "messages_content_fts_gin") return true;
    return false;
  });
  const smChunk = keepTables(full, ["semantic_memory"]).ddl.filter((e) => {
    if (e.entityType === "columns") {
      return ["fts_segmented", "content_fts"].includes(String(e.name));
    }
    if (e.entityType === "indexes" && e.name === "idx_semantic_memory_fts") return true;
    return false;
  });
  snap = removeColumn(snap, "messages", "content_fts");
  snap = removeColumn(snap, "semantic_memory", "content_fts");
  snap = removeIndex(snap, "messages_content_fts_gin");
  snap = removeIndex(snap, "idx_semantic_memory_fts");
  snap.ddl.push(...msgChunk, ...smChunk);
  writeSnapshot("20260609140000_fts_segmented", snap);

  snap = nextSnap(snap);
  writeSnapshot("20260610120000_pg_trgm", snap);

  console.log("repair-snapshot-chain: wrote 9 snapshot.json files");
}

main();
