import { expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { semanticMemory } from "@freeanima/core/db/schema";

import {
  buildSemanticConditions,
  buildSemanticSourceConversationsCondition,
  buildSemanticStatusCondition,
  buildSemanticTypeCondition,
} from "./semantic-filters.ts";

test("buildSemanticTypeCondition empty / single / multi", () => {
  expect(buildSemanticTypeCondition([])).toBeUndefined();
  expect(buildSemanticTypeCondition(["world"])).toEqual(eq(semanticMemory.type, "world"));
  expect(buildSemanticTypeCondition(["world", "preference"])).toEqual(
    inArray(semanticMemory.type, ["world", "preference"]),
  );
});

test("buildSemanticStatusCondition active vs all", () => {
  expect(buildSemanticStatusCondition("all")).toBeUndefined();
  expect(buildSemanticStatusCondition("active")).toEqual(eq(semanticMemory.status, "active"));
});

test("buildSemanticSourceConversationsCondition requires non-empty conversations", () => {
  expect(buildSemanticSourceConversationsCondition([])).toBeUndefined();
  expect(buildSemanticSourceConversationsCondition(["s1"])).toBeDefined();
});

test("buildSemanticConditions composes filters", () => {
  const conditions = buildSemanticConditions({
    types: ["world"],
    status: "active",
    source_conversations: ["sess-a"],
  });
  expect(conditions).toHaveLength(3);
  expect(and(...conditions)).toBeDefined();
});
