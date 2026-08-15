import { expect, test } from "bun:test";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  entities,
  searchDocuments,
  SEMANTIC_MEMORY_COMPONENT,
} from "@freeanima/habitat/core/db/schema";

import {
  buildSemanticClusterCondition,
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
  const single = buildSemanticSourceConversationsCondition(["s1"]);
  expect(single).toBeDefined();
  expect(single).toEqual(
    sql`(${entities.body}->'source_conversations') ?| ${sql`ARRAY[${sql.join(
      ["s1"].map((v) => sql`${v}`),
      sql`, `,
    )}]::text[]`}`,
  );
  const multi = buildSemanticSourceConversationsCondition(["s1", "s2"]);
  expect(multi).toEqual(
    sql`(${entities.body}->'source_conversations') ?| ${sql`ARRAY[${sql.join(
      ["s1", "s2"].map((v) => sql`${v}`),
      sql`, `,
    )}]::text[]`}`,
  );
});

test("buildSemanticClusterCondition undefined / null / id", () => {
  expect(buildSemanticClusterCondition(undefined)).toBeUndefined();
  expect(buildSemanticClusterCondition(null)).toEqual(isNull(searchDocuments.cluster_id));
  expect(buildSemanticClusterCondition(3)).toEqual(eq(searchDocuments.cluster_id, 3));
});

test("buildSemanticConditions composes filters", () => {
  const conditions = buildSemanticConditions({
    types: ["world"],
    status: "active",
    source_conversations: ["sess-a"],
    cluster_id: 2,
  });
  expect(conditions).toHaveLength(5);
  expect(conditions[0]).toEqual(eq(entities.primary_component, SEMANTIC_MEMORY_COMPONENT));
  expect(and(...conditions)).toBeDefined();
});
