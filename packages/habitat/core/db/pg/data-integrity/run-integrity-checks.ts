import { asRecord } from "@freeanima/shared/util";
import { isNull } from "drizzle-orm";

import { entities } from "@freeanima/habitat/core/db/schema/entity/entity.ts";

import { getDb, type DbSession } from "../client.ts";
import { auditEntities } from "./audit-entities.ts";
import type { ConfiguredSubjects, DataIntegrityReport, EntityIntegritySnapshot } from "./types.ts";

export type RunIntegrityChecksOpts = {
  configuredSubjects?: ConfiguredSubjects;
  /** 返回 issues 上限；默认不截断。UI 可传较小值。 */
  issueLimit?: number;
  /** 是否包含软删实体；默认 false */
  includeDeleted?: boolean;
  session?: DbSession;
};

function asBody(raw: unknown): Record<string, unknown> | null {
  return asRecord(raw);
}

/** 从当前库加载实体并跑通用数据完整性检查 */
export async function runIntegrityChecks(
  opts?: RunIntegrityChecksOpts,
): Promise<DataIntegrityReport> {
  const db = opts?.session ?? getDb();
  const query = db
    .select({
      id: entities.id,
      type: entities.type,
      world_id: entities.world_id,
      primary_component: entities.primary_component,
      body: entities.body,
      deleted_at: entities.deleted_at,
    })
    .from(entities);

  const rows = opts?.includeDeleted ? await query : await query.where(isNull(entities.deleted_at));

  const snapshots: EntityIntegritySnapshot[] = rows.map((row) => ({
    id: row.id,
    type: row.type,
    world_id: row.world_id,
    primary_component: row.primary_component,
    body: asBody(row.body),
    deleted_at: row.deleted_at,
  }));

  return auditEntities(snapshots, {
    ...(opts?.configuredSubjects != null ? { configuredSubjects: opts.configuredSubjects } : {}),
    ...(opts?.issueLimit != null ? { issueLimit: opts.issueLimit } : {}),
  });
}
