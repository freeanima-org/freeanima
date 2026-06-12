import { expect, test } from "bun:test";
import { and, eq, inArray } from "drizzle-orm";
import { semanticMemory } from "@freeanima/storage-db/schema";

import {
  buildSemanticConditions,
  buildSemanticSourceSessionsCondition,
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

test("buildSemanticSourceSessionsCondition requires non-empty sessions", () => {
  expect(buildSemanticSourceSessionsCondition([])).toBeUndefined();
  expect(buildSemanticSourceSessionsCondition(["s1"])).toBeDefined();
});

test("buildSemanticConditions composes filters", () => {
  const conditions = buildSemanticConditions({
    types: ["world"],
    status: "active",
    sourceSessions: ["sess-a"],
  });
  expect(conditions).toHaveLength(3);
  expect(and(...conditions)).toBeDefined();
});
