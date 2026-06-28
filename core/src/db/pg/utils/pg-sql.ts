import { sql as drizzleSql } from "drizzle-orm";

/** `AND sm.type = ?` or `AND sm.type = ANY(?)`. */
export function pgSemanticTypeFilter(types: readonly string[]) {
  if (types.length === 0) return drizzleSql``;
  if (types.length === 1) return drizzleSql`AND sm.type = ${types[0]}`;
  return drizzleSql`AND sm.type = ANY(${[...types]})`;
}

/** `AND sm.source_conversations && ?` when non-empty. */
export function pgSemanticSourceSessionsFilter(source_conversations: readonly string[]) {
  if (source_conversations.length === 0) return drizzleSql``;
  return drizzleSql`AND sm.source_conversations && ${[...source_conversations]}`;
}
