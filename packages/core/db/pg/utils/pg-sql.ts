import { sql as drizzleSql, type SQL } from "drizzle-orm";

/**
 * Bun SQL 不能把 JS string[] 可靠绑成 text[]。
 * 展开为 `ARRAY[$1,$2,…]::text[]`，供 `ANY(...)` / `?|` 等使用。
 */
export function pgTextArray(values: readonly string[]): SQL {
  return drizzleSql`ARRAY[${drizzleSql.join(
    values.map((v) => drizzleSql`${v}`),
    drizzleSql`, `,
  )}]::text[]`;
}

/** 展开为 `ARRAY[$1,$2,…]::bigint[]`，供 `@>` / `&&` 等使用。 */
export function pgBigintArray(values: readonly number[]): SQL {
  return drizzleSql`ARRAY[${drizzleSql.join(
    values.map((v) => drizzleSql`${v}`),
    drizzleSql`, `,
  )}]::bigint[]`;
}

/** `AND sm.type = ?` or `AND sm.type = ANY(?)`. */
export function pgSemanticTypeFilter(types: readonly string[]) {
  if (types.length === 0) return drizzleSql``;
  if (types.length === 1) return drizzleSql`AND sm.type = ${types[0]}`;
  return drizzleSql`AND sm.type = ANY(${pgTextArray(types)})`;
}

/** `AND sm.source_conversations && ?` when non-empty. */
export function pgSemanticSourceSessionsFilter(source_conversations: readonly string[]) {
  if (source_conversations.length === 0) return drizzleSql``;
  return drizzleSql`AND sm.source_conversations && ${pgTextArray(source_conversations)}`;
}
