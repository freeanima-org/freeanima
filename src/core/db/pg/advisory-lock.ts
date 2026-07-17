import { sql } from "drizzle-orm";

import { getDb, type DbTransaction } from "./client.ts";

/**
 * 在事务内获取 PG advisory xact lock，锁随 COMMIT/ROLLBACK 自动释放。
 * namespace + resourceKey 经 hashtext 映射为两路 int4 锁键。
 */
export async function withAdvisoryXactLock<T>(
  namespace: string,
  resourceKey: string | number,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  const db = getDb();
  const resource = String(resourceKey);
  return db.transaction(async (tx) => {
    await tx
      .select({
        locked: sql`pg_advisory_xact_lock(hashtext(${namespace}), hashtext(${resource}))`,
      })
      .from(sql`(SELECT 1) AS _advisory_lock`);
    return fn(tx);
  });
}
