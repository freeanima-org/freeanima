import type { SubjectKind } from "@freeanima/habitat/core/config";
import { resolveSubjectWorldId } from "@freeanima/habitat/core/config/world-context";
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

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function objectiveWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

export async function serviceObjectiveList(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    parent_id?: number | null;
    status?: ObjectiveStatusPayload;
    include_inactive?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
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
  input: { subject_kind: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const item = await getObjective(worldId, input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
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
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const { subject_kind: _sk, ...rest } = input;
  const item = await createObjective(worldId, omitUndefined(rest));
  return { item };
}

export async function serviceObjectivePatch(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
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
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const { subject_kind: _sk, ...rest } = input;
  const item = await updateObjective(worldId, omitUndefined(rest));
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveDelete(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number; client_op_id?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const ok = await deleteObjective(worldId, input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceObjectiveLink(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    id: number;
    link: ObjectiveLinkPayload;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const item = await linkObjective(worldId, input.id, input.link);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceObjectiveUnlink(
  deps: RuntimeDeps,
  input: {
    subject_kind: SubjectKind;
    id: number;
    link: ObjectiveLinkPayload;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await objectiveWorldIdForAuth(auth, input.subject_kind);
  const item = await unlinkObjective(worldId, input.id, input.link);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}
