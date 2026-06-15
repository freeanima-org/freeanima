import { describe, expect, test } from "bun:test";

import { pgSemanticSourceSessionsFilter, pgSemanticTypeFilter } from "./pg-sql.ts";

describe("pg-sql", () => {
  test("pgSemanticTypeFilter empty returns blank fragment", () => {
    expect(pgSemanticTypeFilter([]).queryChunks).toHaveLength(0);
  });

  test("pgSemanticTypeFilter non-empty produces SQL fragment", () => {
    expect(pgSemanticTypeFilter(["observation"]).queryChunks.length).toBeGreaterThan(0);
    expect(pgSemanticTypeFilter(["a", "b"]).queryChunks.length).toBeGreaterThan(0);
  });

  test("pgSemanticSourceSessionsFilter non-empty produces SQL fragment", () => {
    expect(pgSemanticSourceSessionsFilter(["s1", "s2"]).queryChunks.length).toBeGreaterThan(0);
  });
});
