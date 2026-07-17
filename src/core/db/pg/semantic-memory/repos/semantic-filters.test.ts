import { expect, test } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { entities, SEMANTIC_MEMORY_COMPONENT } from "@freeanima/core/db/schema";

import {
  buildSemanticConditions,
  buildSemanticSourceConversationsCondition,
  buildSemanticStatusCondition,
  buildSemanticTypeCondition,
} from "./semantic-filters.ts";

test("buildSemanticTypeCondition empty / single / multi", () => {
  expect(buildSemanticTypeCondition([])).toBeUndefined();
  expect(buildSemanticTypeCondition(["world"])).toEqual(
    sql`${entities.body}->>'memory_kind' = ${"world"}`,
  );
  expect(buildSemanticTypeCondition(["world", "preference"])).toEqual(
    sql`${entities.body}->>'memory_kind' IN (${sql.join(
      ["world", "preference"].map((t) => sql`${t}`),
      sql`, `,
    )})`,
  );
});

test("buildSemanticStatusCondition active vs all", () => {
  expect(buildSemanticStatusCondition("all")).toBeUndefined();
  expect(buildSemanticStatusCondition("active")).toEqual(
    sql`${entities.body}->>'status' = ${"active"}`,
  );
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
  expect(conditions).toHaveLength(4);
  expect(conditions[0]).toEqual(eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT));
  expect(and(...conditions)).toBeDefined();
});
