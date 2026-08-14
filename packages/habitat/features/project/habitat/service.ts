import type { SubjectKind } from "@freeanima/habitat/core/config";
import { resolveSubjectWorldId } from "@freeanima/habitat/core/config/world-context";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";
import type { ProjectStatus } from "@freeanima/habitat/core/db/schema/entity";

import {
  createProject,
  createProjectFolder,
  deleteProject,
  deleteProjectFolder,
  getProject,
  listProjectFolders,
  listProjects,
  listProjectTaskStats,
  updateProject,
  updateProjectFolder,
} from "../domain/index.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: RpcRequestAuthContext, subject_kind?: SubjectKind): void {
  if (!subject_kind || subject_kind === auth.subject_type) return;
  // 单实例 Habitat：user token 可访问 agent 私有 world（Shell User/Agent 切换）
  if (auth.subject_type === "user" && subject_kind === "agent") return;
  throw new Error("FORBIDDEN_SUBJECT");
}

function resolveSubjectKind(subject_kind: SubjectKind | undefined): SubjectKind {
  if (subject_kind !== "user" && subject_kind !== "agent") {
    throw new Error("subject_kind is required (user|agent)");
  }
  return subject_kind;
}

async function projectWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  const kind = resolveSubjectKind(subject_kind);
  assertSubjectKindMatches(auth, kind);
  return resolveSubjectWorldId(kind);
}

export async function serviceProjectfolderList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const folders = await listProjectFolders(await projectWorldIdForAuth(auth, input?.subject_kind));
  return { folders };
}

export async function serviceProjectfolderCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    name: string;
    parent_id?: number | null;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createProjectFolder(
    await projectWorldIdForAuth(auth, subject_kind),
    createInput,
  );
  return { item };
}

export async function serviceProjectfolderPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    name?: string;
    parent_id?: number | null;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateProjectFolder(await projectWorldIdForAuth(auth, subject_kind), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectfolderDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteProjectFolder(
    await projectWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceProjectList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    folder_id?: number | null;
    status?: ProjectStatus;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await projectWorldIdForAuth(auth, input.subject_kind);
  const projects = await listProjects(
    worldId,
    omitUndefined({ folder_id: input.folder_id, status: input.status }),
  );
  return { projects };
}

export async function serviceProjectStats(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    folder_id?: number | null;
    status?: ProjectStatus;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await projectWorldIdForAuth(auth, input.subject_kind);
  const counts = await listProjectTaskStats(
    worldId,
    omitUndefined({ folder_id: input.folder_id, status: input.status }),
  );
  return { counts };
}

export async function serviceProjectCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    start_at?: string | null;
    end_at?: string | null;
    content?: string;
    folder_id?: number | null;
    product_tag?: string;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createProject(await projectWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceProjectGet(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await getProject(await projectWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    start_at?: string | null;
    end_at?: string | null;
    content?: string;
    folder_id?: number | null;
    product_tag?: string | null;
    status?: ProjectStatus;
    sort_order?: number;
    release_tasks?: boolean;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateProject(await projectWorldIdForAuth(auth, subject_kind), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteProject(await projectWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}
