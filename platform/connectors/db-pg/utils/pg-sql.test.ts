import { describe, expect, test } from "bun:test";

import { pgSqlLiteral, pgTextArrayAny, pgTextArrayLiteral, pgTextArrayOverlap } from "./pg-sql.ts";

describe("pg-sql", () => {
  test("pgSqlLiteral escapes single quotes", () => {
    expect(pgSqlLiteral("a'b")).toBe("'a''b'");
  });

  test("pgTextArrayLiteral builds ARRAY literal", () => {
    expect(pgTextArrayLiteral([])).toBe("'{}'::text[]");
    expect(pgTextArrayLiteral(["a", "b"])).toBe("ARRAY['a', 'b']::text[]");
    expect(pgTextArrayLiteral(["it's"])).toBe("ARRAY['it''s']::text[]");
  });

  test("pgTextArrayOverlap and pgTextArrayAny raw SQL strings", () => {
    // drizzleSql.raw stores SQL in queryChunks[0].value
    const overlap = pgTextArrayOverlap("sm.source_sessions", ["s1", "s2"]);
    const chunkVal = (overlap.queryChunks[0] as { value: string | string[] }).value;
    const overlapSql = Array.isArray(chunkVal) ? chunkVal.join("") : chunkVal;
    expect(overlapSql).toBe("sm.source_sessions && ARRAY['s1', 's2']::text[]");

    const anyChunk = (
      pgTextArrayAny("sm.type", ["experience", "imprint"]).queryChunks[0] as {
        value: string | string[];
      }
    ).value;
    const anySql = Array.isArray(anyChunk) ? anyChunk.join("") : anyChunk;
    expect(anySql).toBe("sm.type = ANY(ARRAY['experience', 'imprint']::text[])");
  });
});
