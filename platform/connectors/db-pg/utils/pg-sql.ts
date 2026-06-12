import { sql as drizzleSql } from "drizzle-orm";

/** Escape a string for use inside a PostgreSQL single-quoted literal. */
export function pgSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Build `ARRAY['a','b']::text[]` or `'{}'::text[]` for raw SQL fragments. */
export function pgTextArrayLiteral(values: readonly string[]): string {
  if (!values.length) return "'{}'::text[]";
  return `ARRAY[${values.map((v) => pgSqlLiteral(v)).join(", ")}]::text[]`;
}

/** Drizzle fragment: `column && ARRAY[...]::text[]` (overlap). */
export function pgTextArrayOverlap(column: string, values: readonly string[]) {
  return drizzleSql.raw(`${column} && ${pgTextArrayLiteral(values)}`);
}

/** Drizzle fragment: `column = ANY(ARRAY[...]::text[])`. */
export function pgTextArrayAny(column: string, values: readonly string[]) {
  return drizzleSql.raw(`${column} = ANY(${pgTextArrayLiteral(values)})`);
}

/** `AND sm.type = ?` or `AND sm.type = ANY(ARRAY[...]::text[])`. */
export function pgSemanticTypeFilter(types: readonly string[]) {
  if (types.length === 0) return drizzleSql``;
  if (types.length === 1) return drizzleSql`AND sm.type = ${types[0]}`;
  return drizzleSql`AND ${pgTextArrayAny("sm.type", types)}`;
}

/** `AND sm.source_sessions && ARRAY[...]::text[]` when non-empty. */
export function pgSemanticSourceSessionsFilter(sourceSessions: readonly string[]) {
  if (sourceSessions.length === 0) return drizzleSql``;
  return drizzleSql`AND ${pgTextArrayOverlap("sm.source_sessions", sourceSessions)}`;
}
