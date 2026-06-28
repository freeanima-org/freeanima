import { arrayOverlaps, eq, inArray, type SQL } from "drizzle-orm";
import { semanticMemory } from "@freeanima/core/db/schema";

export function buildSemanticTypeCondition(types: readonly string[]): SQL | undefined {
  if (types.length === 0) return undefined;
  if (types.length === 1) return eq(semanticMemory.type, types[0]!);
  return inArray(semanticMemory.type, [...types]);
}

export function buildSemanticStatusCondition(
  status: "active" | "deprecated" | "all",
): SQL | undefined {
  if (status === "all") return undefined;
  return eq(semanticMemory.status, status);
}

export function buildSemanticSourceConversationsCondition(
  source_conversations: readonly string[],
): SQL | undefined {
  if (source_conversations.length === 0) return undefined;
  return arrayOverlaps(semanticMemory.source_conversations, [...source_conversations]);
}

export function buildSemanticConditions(args: {
  types?: readonly string[];
  status?: "active" | "deprecated" | "all";
  source_conversations?: readonly string[];
}): SQL[] {
  const conditions: SQL[] = [];
  const typeCond = buildSemanticTypeCondition(args.types ?? []);
  if (typeCond) conditions.push(typeCond);
  const statusCond = buildSemanticStatusCondition(args.status ?? "active");
  if (statusCond) conditions.push(statusCond);
  const sourceCond = buildSemanticSourceConversationsCondition(args.source_conversations ?? []);
  if (sourceCond) conditions.push(sourceCond);
  return conditions;
}
