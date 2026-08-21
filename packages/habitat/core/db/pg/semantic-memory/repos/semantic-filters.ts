import { eq, isNull, sql as drizzleSql, type SQL } from "drizzle-orm";
import {
  SEMANTIC_MEMORY_COMPONENT,
  entities,
  searchDocuments,
} from "@freeanima/habitat/core/db/schema";
import { pgTextArray } from "../../utils/pg-sql.ts";

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
  return drizzleSql`(${entities.body}->'source_conversations') ?| ${pgTextArray(ids)}`;
}

/** 省略=不筛；null=未分组；整数=该簇。调用方须已 join search_documents。 */
export function buildSemanticClusterCondition(
  cluster_id: number | null | undefined,
): SQL | undefined {
  if (cluster_id === undefined) return undefined;
  if (cluster_id === null) return isNull(searchDocuments.cluster_id);
  return eq(searchDocuments.cluster_id, cluster_id);
}

export function buildSemanticPrimaryCondition(): SQL {
  return eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT);
}

export function buildSemanticConditions(args: {
  types?: readonly string[];
  status?: "active" | "deprecated" | "all";
  source_conversations?: readonly string[];
  cluster_id?: number | null;
  world_id?: number;
}): SQL[] {
  const conditions: SQL[] = [buildSemanticPrimaryCondition()];
  const typeCond = buildSemanticTypeCondition(args.types ?? []);
  if (typeCond) conditions.push(typeCond);
  const statusCond = buildSemanticStatusCondition(args.status ?? "active");
  if (statusCond) conditions.push(statusCond);
  const sourceCond = buildSemanticSourceConversationsCondition(args.source_conversations ?? []);
  if (sourceCond) conditions.push(sourceCond);
  const clusterCond = buildSemanticClusterCondition(args.cluster_id);
  if (clusterCond) conditions.push(clusterCond);
  if (args.world_id != null) {
    conditions.push(eq(entities.world_id, args.world_id));
  }
  return conditions;
}
