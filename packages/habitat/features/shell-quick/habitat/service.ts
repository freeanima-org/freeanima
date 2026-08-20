import type { SubjectKind } from "@freeanima/habitat/core/config";
import { resolveSubjectWorldId } from "@freeanima/habitat/core/config/world-context";
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

async function worldIdForAuth(
  auth: RpcRequestAuthContext,
  subject_kind?: SubjectKind,
): Promise<number> {
  assertSubjectKindMatches(auth, subject_kind);
  const kind = resolveSubjectKind(subject_kind ?? auth.subject_type);
  return resolveSubjectWorldId(kind);
}

export async function serviceShellQuickList(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_kind);
  const entries = await listShellQuickEntries({ worldId });
  return { entries };
}

export async function serviceShellQuickAttach(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_kind);
  const entry = await attachShellQuickEntry({ worldId }, input.id);
  return { entry };
}

export async function serviceShellQuickDetach(
  deps: RuntimeDeps,
  input: { subject_kind: SubjectKind; id: number },
  auth: RpcRequestAuthContext,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_kind);
  await detachShellQuickEntry({ worldId }, input.id);
  return { ok: true as const };
}
