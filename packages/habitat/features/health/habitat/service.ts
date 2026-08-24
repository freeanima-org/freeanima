import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  createHealthRecord,
  deleteHealthRecord,
  getHealthRecord,
  listHealthRecords,
  queryHealthMetricSeries,
  searchHealthRecords,
  updateHealthRecord,
  type HealthRecordKind,
} from "../domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectIdAllowed(auth: RpcRequestAuthContext, subjectId: number): void {
  if (auth.subject_id === subjectId) return;
  if (auth.subject_type === "user") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function requireSubjectId(subject_id: number | undefined): number {
  if (subject_id == null || !Number.isInteger(subject_id) || subject_id <= 0) {
    throw new Error("subject_id is required");
  }
  return subject_id;
}

async function healthWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceHealthList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    record_kind?: HealthRecordKind;
    profile_key?: string;
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const items = await listHealthRecords(
    worldId,
    omitUndefined({
      record_kind: input.record_kind,
      profile_key: input.profile_key,
      limit: input.limit,
      offset: input.offset,
    }),
  );
  return { items };
}

export async function serviceHealthGet(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const item = await getHealthRecord(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHealthSearch(
  deps: RuntimeDeps,
  input: { subject_id: number; query: string; limit?: number; offset?: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  return searchHealthRecords(
    worldId,
    omitUndefined({
      query: input.query,
      limit: input.limit,
      offset: input.offset,
    }),
  );
}

export async function serviceHealthCreate(
  deps: RuntimeDeps,
  input: Parameters<typeof createHealthRecord>[1] & { subject_id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _subjectId, ...rest } = input;
  const item = await createHealthRecord(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceHealthPatch(
  deps: RuntimeDeps,
  input: Parameters<typeof updateHealthRecord>[1] & { subject_id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _subjectId, ...rest } = input;
  const item = await updateHealthRecord(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceHealthDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const ok = await deleteHealthRecord(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceHealthMetricsSeries(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    metric_key: string;
    profile_key?: string;
    since?: string;
    until?: string;
    limit?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await healthWorldIdForAuth(auth, input.subject_id);
  const points = await queryHealthMetricSeries(
    worldId,
    omitUndefined({
      metric_key: input.metric_key,
      profile_key: input.profile_key,
      since: input.since,
      until: input.until,
      limit: input.limit,
    }),
  );
  return { points };
}
