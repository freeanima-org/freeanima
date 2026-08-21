import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
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

async function projectWorldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceProjectfolderList(
  deps: RuntimeDeps,
  input: { subject_id?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const folders = await listProjectFolders(await projectWorldIdForAuth(auth, input?.subject_id));
  return { folders };
}

export async function serviceProjectfolderCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    name: string;
    parent_id?: number | null;
    sort_order?: number;
    client_op_id?: string;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_id, ...createInput } = input;
  const item = await createProjectFolder(
    await projectWorldIdForAuth(auth, subject_id),
    createInput,
  );
  return { item };
}

export async function serviceProjectfolderPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    name?: string;
    parent_id?: number | null;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_id, ...patch } = input;
  const item = await updateProjectFolder(await projectWorldIdForAuth(auth, subject_id), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectfolderDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteProjectFolder(
    await projectWorldIdForAuth(auth, input.subject_id),
    input.id,
  );
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export async function serviceProjectList(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    folder_id?: number | null;
    status?: ProjectStatus;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await projectWorldIdForAuth(auth, input.subject_id);
  const projects = await listProjects(
    worldId,
    omitUndefined({ folder_id: input.folder_id, status: input.status }),
  );
  return { projects };
}

export async function serviceProjectStats(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    folder_id?: number | null;
    status?: ProjectStatus;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await projectWorldIdForAuth(auth, input.subject_id);
  const counts = await listProjectTaskStats(
    worldId,
    omitUndefined({ folder_id: input.folder_id, status: input.status }),
  );
  return { counts };
}

export async function serviceProjectCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
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
  const { subject_id, ...createInput } = input;
  const item = await createProject(await projectWorldIdForAuth(auth, subject_id), createInput);
  return { item };
}

export async function serviceProjectGet(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await getProject(await projectWorldIdForAuth(auth, input.subject_id), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
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
  const { id, subject_id, ...patch } = input;
  const item = await updateProject(await projectWorldIdForAuth(auth, subject_id), {
    id,
    ...patch,
  });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceProjectDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteProject(await projectWorldIdForAuth(auth, input.subject_id), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}
