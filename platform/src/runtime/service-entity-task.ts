import {
  completeTaskItem,
  createTaskItem,
  createTaskList,
  deleteTaskItem,
  deleteTaskList,
  ensureDefaultTaskListForWorld,
  listTaskItems,
  listTaskLists,
  uncompleteTaskItem,
  updateTaskItem,
  updateTaskList,
} from "@freeanima/capabilities-task";
import { getResolvedWorldContext, type SubjectKind } from "@freeanima/core/config";
import { subjectConfigBodySchema } from "@freeanima/core/db/schema";
import { getEntity } from "@freeanima/core/db/pg/entity";
import type { VerifiedServiceApiToken } from "@freeanima/core/db/pg/service-api-token";
import type { SapRequestAuthContext } from "@freeanima/sap-contract";

import { isPostgresPrimary } from "@freeanima/core/db/pg";
import type { RuntimeDeps } from "./runtime-deps.ts";

function assertPg(_deps: RuntimeDeps): void {
  if (!isPostgresPrimary()) {
    throw new Error("PostgreSQL unavailable");
  }
}

function assertSubjectKindMatches(auth: SapRequestAuthContext, subject_kind?: SubjectKind): void {
  if (subject_kind && subject_kind !== auth.subject_type) {
    throw new Error("FORBIDDEN_SUBJECT");
  }
}

async function taskWorldIdForAuth(
  auth: SapRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  assertSubjectKindMatches(auth, subject_kind);
  const row = await getEntity(auth.subject_id);
  if (!row || (row.type !== "user" && row.type !== "agent")) {
    throw new Error("INVALID_AUTH_SUBJECT");
  }
  const parsed = subjectConfigBodySchema.safeParse(row.body);
  const worldId = parsed.success ? parsed.data.default_private_world_id : undefined;
  if (!worldId) {
    throw new Error(`subject ${auth.subject_id} has no default_private_world_id`);
  }
  return worldId;
}

export async function serviceTasklistList(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; include_closed?: boolean } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input?.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const lists = await listTaskLists(worldId, { includeClosed: input?.include_closed });
  return { lists };
}

export async function serviceTasklistCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    name: string;
    sort_order?: number;
    color?: string | null;
    is_folder?: boolean;
    parent_id?: number | null;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskList(await taskWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceTasklistPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    name?: string;
    sort_order?: number;
    closed?: boolean;
    color?: string | null;
    is_folder?: boolean;
    parent_id?: number | null;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskList(await taskWorldIdForAuth(auth, subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTasklistDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number; cascade?: boolean },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  try {
    const ok = await deleteTaskList(await taskWorldIdForAuth(auth, input.subject_kind), input.id, {
      cascade: input.cascade ?? true,
    });
    if (!ok) throw new Error("NOT_FOUND");
    return { ok: true as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("default task list")) {
      throw new Error("DEFAULT_LIST_CANNOT_DELETE", { cause: err });
    }
    throw err;
  }
}

export async function serviceTaskList(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    list_id?: number;
    status?: "pending" | "completed" | "all";
    due_today?: boolean;
    tags?: string[];
    limit?: number;
    offset?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await taskWorldIdForAuth(auth, input.subject_kind);
  await ensureDefaultTaskListForWorld(worldId);
  const items = await listTaskItems(worldId, {
    list_id: input.list_id,
    status: input.status ?? "all",
    due_today: input.due_today,
    tags: input.tags,
    limit: input.limit,
    offset: input.offset,
  });
  return { items };
}

export async function serviceTaskCreate(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    title: string;
    list_id: number;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { subject_kind, ...createInput } = input;
  const item = await createTaskItem(await taskWorldIdForAuth(auth, subject_kind), createInput);
  return { item };
}

export async function serviceTaskPatch(
  deps: RuntimeDeps,
  input: {
    subject_kind?: SubjectKind;
    id: number;
    title?: string;
    list_id?: number;
    content?: string;
    tags?: string[];
    priority?: "high" | "medium" | "low" | "none";
    due_at?: string | null;
    sort_order?: number;
    status?: "pending" | "completed";
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const { id, subject_kind, ...patch } = input;
  const item = await updateTaskItem(await taskWorldIdForAuth(auth, subject_kind), { id, ...patch });
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskComplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await completeTaskItem(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskUncomplete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const item = await uncompleteTaskItem(
    await taskWorldIdForAuth(auth, input.subject_kind),
    input.id,
  );
  if (!item) throw new Error("NOT_FOUND");
  return { item };
}

export async function serviceTaskDelete(
  deps: RuntimeDeps,
  input: { subject_kind?: SubjectKind; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const ok = await deleteTaskItem(await taskWorldIdForAuth(auth, input.subject_kind), input.id);
  if (!ok) throw new Error("NOT_FOUND");
  return { ok: true as const };
}

export function serviceWorldsContext(_deps: RuntimeDeps) {
  return getResolvedWorldContext();
}
