import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  attachShellQuickEntry,
  detachShellQuickEntry,
  listShellQuickEntries,
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

async function worldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_id: number | undefined,
): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

export async function serviceShellQuickList(
  deps: RuntimeDeps,
  input: { subject_id: number },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  const entries = await listShellQuickEntries({ worldId });
  return { entries };
}

export async function serviceShellQuickAttach(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  const entry = await attachShellQuickEntry({ worldId }, input.id);
  return { entry };
}

export async function serviceShellQuickDetach(
  deps: RuntimeDeps,
  input: { subject_id: number; id: number },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  await detachShellQuickEntry({ worldId }, input.id);
  return { ok: true as const };
}
