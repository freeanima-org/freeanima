import { eq, inArray, sql as drizzleSql, type SQL } from "drizzle-orm";
import { SEMANTIC_MEMORY_COMPONENT, entities } from "@freeanima/core/db/schema";

export function buildSemanticTypeCondition(types: readonly string[]): SQL | undefined {
  if (types.length === 0) return undefined;
  if (types.length === 1) {
    const type = types[0];
    if (type === undefined) return undefined;
    return drizzleSql`${entities.body}->>'memory_kind' = ${type}`;
  }
  return drizzleSql`${entities.body}->>'memory_kind' IN (${drizzleSql.join(
    types.map((t) => drizzleSql`${t}`),
    drizzleSql`, `,
  )})`;
}

export function buildSemanticStatusCondition(
  status: "active" | "deprecated" | "all",
): SQL | undefined {
  if (status === "all") return undefined;
  return drizzleSql`${entities.body}->>'status' = ${status}`;
}

export function buildSemanticSourceConversationsCondition(
  source_conversations: readonly string[],
): SQL | undefined {
  if (source_conversations.length === 0) return undefined;
  const ids = [...source_conversations];
  return drizzleSql`EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(${entities.body}->'source_conversations', '[]'::jsonb)) AS e(val)
    WHERE e.val = ANY(${ids})
  )`;
}

export function buildSemanticPrimaryCondition(): SQL {
  return eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT);
}

export function buildSemanticConditions(args: {
  types?: readonly string[];
  status?: "active" | "deprecated" | "all";
  source_conversations?: readonly string[];
}): SQL[] {
  const conditions: SQL[] = [buildSemanticPrimaryCondition()];
  const typeCond = buildSemanticTypeCondition(args.types ?? []);
  if (typeCond) conditions.push(typeCond);
  const statusCond = buildSemanticStatusCondition(args.status ?? "active");
  if (statusCond) conditions.push(statusCond);
  const sourceCond = buildSemanticSourceConversationsCondition(args.source_conversations ?? []);
  if (sourceCond) conditions.push(sourceCond);
  return conditions;
}

/** @deprecated unused after entity migration */
export function buildSemanticIdInCondition(ids: readonly number[]): SQL | undefined {
  if (ids.length === 0) return undefined;
  return inArray(entities.id, [...ids]);
}
