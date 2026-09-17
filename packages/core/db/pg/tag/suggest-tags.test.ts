import { afterEach, describe, expect, it } from "bun:test";
import { and, eq, sql } from "drizzle-orm";

import { TAG_COMPONENT, entities } from "@freeanima/core/db/schema";
import { getDb, initDatabase, resetDatabaseForTest } from "../client.ts";

/** 与 suggest-tags.ts 生产路径一致的外层 id 引用 */
const OUTER_TAG_ID = sql.raw(`"entities"."id"`);

afterEach(() => {
  resetDatabaseForTest();
});

describe("suggest-tags SQL 外层 id 限定", () => {
  it('SELECT 投影中的 count 子查询使用 ARRAY["entities"."id"]', () => {
    initDatabase({ getDatabaseUrl: () => "postgresql://unit:unit@127.0.0.1:1/unit" });
    const db = getDb();
    const worldId = 3;
    const primaryComponent = "task_item";
    const countExpr = sql<number>`(
      SELECT count(*)::int FROM ${entities} AS d
      WHERE d.world_id = ${worldId}
        AND d.primary_component = ${primaryComponent}
        AND d.tag_ids @> ARRAY[${OUTER_TAG_ID}]::bigint[]
    )`;
    const q = db
      .select({
        id: entities.id,
        title: entities.title,
        count: countExpr,
      })
      .from(entities)
      .where(
        and(
          eq(entities.world_id, worldId),
          eq(entities.primary_component, TAG_COMPONENT),
          sql`EXISTS (
            SELECT 1 FROM ${entities} AS d
            WHERE d.tag_ids @> ARRAY[${OUTER_TAG_ID}]::bigint[]
          )`,
        ),
      )
      .limit(10);

    const { sql: text } = q.toSQL();
    expect(text).toContain('ARRAY["entities"."id"]');
    // 危险形态：未限定 ARRAY["id"] 会在子查询内绑到 d.id
    expect(text).not.toMatch(/ARRAY\["id"\]/);
  });
});
