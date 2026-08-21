import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import type {
  ObjectiveCompletionPayload,
  ObjectiveLinkPayload,
  ObjectiveStatusPayload,
} from "@freeanima/shared/rpc-contract/frames/objective";

import {
  createObjective,
  deleteObjective,
  getObjective,
  linkObjective,
  listObjectives,
  unlinkObjective,
  updateObjective,
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

async function objectiveWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceObjectiveList(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    parent_id?: number | null;
    status?: ObjectiveStatusPayload;
    include_inactive?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const items = await listObjectives(
    worldId,
    omitUndefined({
      parent_id: input.parent_id,
      status: input.status,
      include_inactive: input.include_inactive,
    }),
  );
  return { items };
}

export async function serviceObjectiveGet(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const item = await getObjective(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveCreate(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    title: string;
    content?: string;
    parent_id?: number | null;
    status?: ObjectiveStatusPayload;
    start_at?: string | null;
    end_at?: string | null;
    completion?: ObjectiveCompletionPayload;
    links?: ObjectiveLinkPayload[];
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await createObjective(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceObjectivePatch(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    title?: string;
    content?: string;
    parent_id?: number | null;
    status?: ObjectiveStatusPayload;
    start_at?: string | null;
    end_at?: string | null;
    completion?: ObjectiveCompletionPayload;
    links?: ObjectiveLinkPayload[];
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await updateObjective(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveDelete(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number; client_op_id?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const ok = await deleteObjective(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceObjectiveLink(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    link: ObjectiveLinkPayload;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const item = await linkObjective(worldId, input.id, input.link);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveUnlink(
  deps: RuntimeDeps,
  input: {
    subject_id: number;
    id: number;
    link: ObjectiveLinkPayload;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_id);
  const item = await unlinkObjective(worldId, input.id, input.link);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}
