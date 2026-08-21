import { resolvePrivateWorldId } from "@freeanima/habitat/core/config/world-context-pg";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { omitUndefined } from "@freeanima/habitat/core/util";
import type { VerifiedServiceApiToken } from "@freeanima/habitat/core/db/pg/service-api-token";
import type { RpcRequestAuthContext } from "@freeanima/shared/rpc-contract";

import {
  createSubagent,
  deleteSubagent,
  getSubagent,
  getSubagentBySlug,
  listSubagents,
  updateSubagent,
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

async function worldIdForAuth(auth: RpcRequestAuthContext, subject_id?: number): Promise<number> {
  const subjectId = requireSubjectId(subject_id);
  assertSubjectIdAllowed(auth, subjectId);
  return resolvePrivateWorldId(subjectId);
}

function toPayload(row: NonNullable<Awaited<ReturnType<typeof getSubagent>>>) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    skills: row.skills,
    max_loop_iterations: row.max_loop_iterations,
    temperature_tier: row.temperature_tier ?? null,
    allowed_tools: row.allowed_tools,
    denied_tools: row.denied_tools,
    prompt_includes: row.prompt_includes,
    world_id: row.world_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function serviceSubagentList(
  deps: RuntimeDeps,
  input: { subject_id?: number } | undefined,
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const items = await listSubagents(await worldIdForAuth(auth, input?.subject_id));
  return { items: items.map(toPayload) };
}

export async function serviceSubagentGet(
  deps: RuntimeDeps,
  input: { subject_id?: number; id?: number; slug?: string },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  let row = null;
  if (input.id != null) {
    row = await getSubagent(input.id);
    if (row && row.world_id !== worldId) row = null;
  } else if (input.slug) {
    row = await getSubagentBySlug(worldId, input.slug);
  } else {
    throw new Error("id or slug is required");
  }
  if (!row) throw new Error("subagent not found");
  return { item: toPayload(row) };
}

export async function serviceSubagentCreate(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    slug: string;
    title: string;
    summary?: string;
    content?: string;
    skills?: string[];
    max_loop_iterations?: number | null;
    temperature_tier?: "focused" | "balanced" | "creative" | null;
    allowed_tools?: string[];
    denied_tools?: string[];
    prompt_includes?: Array<"self" | "world" | "time">;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, ...rest } = input;
  const item = await createSubagent(worldId, omitUndefined(rest));
  return { item: toPayload(item) };
}

export async function serviceSubagentPatch(
  deps: RuntimeDeps,
  input: {
    subject_id?: number;
    id: number;
    slug?: string;
    title?: string;
    summary?: string;
    content?: string;
    skills?: string[];
    max_loop_iterations?: number | null;
    temperature_tier?: "focused" | "balanced" | "creative" | null;
    allowed_tools?: string[];
    denied_tools?: string[];
    prompt_includes?: Array<"self" | "world" | "time">;
  },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  const { subject_id: _sid, id, ...rest } = input;
  const item = await updateSubagent(worldId, { id, ...omitUndefined(rest) });
  return { item: toPayload(item) };
}

export async function serviceSubagentDelete(
  deps: RuntimeDeps,
  input: { subject_id?: number; id: number },
  auth: VerifiedServiceApiToken,
) {
  assertPg(deps);
  const worldId = await worldIdForAuth(auth, input.subject_id);
  await deleteSubagent(worldId, input.id);
  return { ok: true as const };
}
